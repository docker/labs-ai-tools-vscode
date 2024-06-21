(ns prompts
  (:require
   [babashka.fs :as fs]
   [cheshire.core :as json]
   [clojure.edn :as edn]
   [clojure.java.io :as io]
   [clojure.string :as string]
   [docker]
   [git]
   [markdown.core :as markdown]
   [medley.core :as medley]
   [openai]
   [pogonos.core :as stache]
   [clojure.pprint :refer [pprint]]
   [selmer.parser :as selmer]
   [clojure.tools.cli :as cli]))

(defn- facts [project-facts user platform]
  (medley/deep-merge
   {:platform platform
    :username user
    :project {:files (-> project-facts :project/files)
              :dockerfiles (-> project-facts :project/dockerfiles)
              :composefiles (-> project-facts :project/composefiles)
              :languages (-> project-facts :github/lingust)}
    :languages (->> project-facts
                    :github/linguist
                    keys
                    (map name)
                    (string/join ", "))}
   project-facts))

(defn- name-matches [re]
  (fn [p] (re-matches re (fs/file-name p))))

(defn- selma-render [m f]
  [{:content (stache/render-string (slurp f) m)} f])

(def prompt-file-pattern #".*_(.*)_.*.md")

(defn- merge-role [[m f]]
  (merge m {:role (let [[_ role] (re-find prompt-file-pattern (fs/file-name f))] role)}))

(defn warn [template data]
  (binding [*out* *err*]
    (println
     (selmer/render template data))))

(defn fact-reducer 
  "reduces into m using a container function
     params
       dir - the host dir that the container will mount read-only at /project
       identity-token - a DockerHub identity token
       m - the map to merge into
       container-definition - the definition for the function"
  [dir identity-token m container-definition]
  (try
    (medley/deep-merge
     m
     (let [facts (docker/extract-facts (assoc container-definition :host-dir dir :identity-token identity-token))]
       (case (:output-handler container-definition)
         "linguist" (->> (json/parse-string facts keyword) vals (into []) (assoc {} :linguist))
         (json/parse-string facts keyword))))
    (catch Throwable ex
      (warn
       "unable to render {{ container-definition }} - {{ exception }}"
       {:dir dir
        :container-definition container-definition
        :exception ex})
      m)))

(comment
  (facts
   (fact-reducer "/Users/slim/docker/labs-make-runbook"
                 ""
                 {}
                 {:image "vonwig/go-linguist:latest"
                  :command ["-json"]
                  :output-handler "linguist"})
   "jimclark106" "darwin"))

(defn collect-extractors [dir]
  (let [extractors (-> (markdown/parse-metadata (io/file dir "README.md")) first :extractors)]
    (if (seq extractors)
      extractors
      [{:image "docker/lsp:latest"
        :entrypoint "/app/result/bin/docker-lsp"
        :command ["project-facts"
                  "--vs-machine-id" "none"
                  "--workspace" "/docker"]}])))

(defn collect-functions [dir]
  (->>
    (-> (markdown/parse-metadata (io/file dir "README.md")) first :functions)
    (map (fn [m] {:type "function" :function m}))))

(defn collect-metadata [dir]
  (dissoc
    (-> (markdown/parse-metadata (io/file dir "README.md")) first)
    :extractors :functions))

(defn all-facts 
  "returns a map of extracted *math-context*
     params
       project-root - the host project root dir
       identity-token - a valid Docker login auth token
       dir - a prompst directory with a valid README.md"
  [project-root identity-token dir]
  (reduce (partial fact-reducer project-root identity-token) {} (collect-extractors dir)))

;; registry of prompts directories stores in the docker-prompts volumes
(def registry-file "/prompts/registry.edn")

(defn read-registry 
  "read the from the prompt registry in the current engine volume"
  []
  (try
    (edn/read-string (slurp registry-file))
    (catch java.io.FileNotFoundException _
      {:prompts []})
    (catch Throwable t
      (binding [*out* *err*]
        (println "Warning (corrupt registry.edn): " (.getMessage t)))
      {:prompts []})))

(defn update-registry 
  "update the prompt registry in the current engine volume"
  [f]
  (spit registry-file (pr-str (f (read-registry)))))

(defn- get-dir 
  "returns the prompt directory to use"
  [dir]
  (or
    (when (string/starts-with? dir "github") (git/prompt-dir dir))
    dir
    "docker"))

(defn get-prompts [& args]
  (let [[project-root user platform dir & {:keys [identity-token]}] args
        ;; TODO the docker default no longer makes sense here
        prompt-dir (get-dir dir)
        m (all-facts project-root identity-token prompt-dir)
        renderer (partial selma-render (facts m user platform))
        prompts (->> (fs/list-dir prompt-dir)
                     (filter (name-matches prompt-file-pattern))
                     (sort-by fs/file-name)
                     (into []))]
    (map (comp merge-role renderer fs/file) prompts)))

(defn function-handler [function-name m]
  (println function-name)
  (println m))

(defn- -run-command 
  [& args]
  (cond
    (= "prompts" (first args))
    (concat
     [{:type "docker" :title "using docker in my project"}
      {:type "lazy_docker" :title "using lazy-docker"}
      {:type "npm_setup" :title "using npm"}]
     (->> (:prompts (read-registry))
          (map #(assoc % :saved true))))

    (= "register" (first args))
    (if-let [{:keys [owner repo path]} (git/parse-github-ref (second args))]
      (update-registry (fn [m]
                         (update-in m [:prompts] (fnil conj [])
                                    {:type (second args)
                                     :title (format "%s %s %s"
                                                    owner repo
                                                    (if path (str "-> " path) ""))})))
      (throw (ex-info "Bad GitHub ref" {:ref (second args)})))

    (= "unregister" (first args))
    (update-registry
     (fn [m]
       (update-in m [:prompts] (fn [coll] (remove (fn [{:keys [type]}] (= type (second args))) coll)))))

    (= "run" (first args))
    (let [m (collect-metadata (get-dir (last args)))]
      (openai/openai 
        (merge 
          {:messages (apply get-prompts (rest args))}
          (when-let [functions (collect-functions (get-dir (last args)))]
            (when (seq functions) {:tools functions}))
          m) 
        (partial openai/chunk-handler function-handler)))

    :else
    (apply get-prompts args)))

(defn prompts [& args]
  (println
   (json/generate-string (apply -run-command args))))

(def cli-opts [[nil "--identity-token TOKEN" "IDENTITY-TOKEN"]])

(defn -main [& args]
  (try
    (let [{:keys [arguments options]} (cli/parse-opts args cli-opts)]
      ;; positional args are
      ;;   host-project-root user platform prompt-dir-or-github-ref & {opts}
      (apply prompts (concat 
                       arguments
                       (when (:identity-token options)
                         [:identity-token (:identity-token options)]))))
    (catch Throwable t
      (warn "Error: {{ exception }}" {:exception t})
      (System/exit 1))))

(comment
  (collect-extractors "docker")
  (->> (-run-command "/Users/slim/docker/labs-make-runbook/" "jimclark106" "darwin" "npm_setup")
       (map :content)
       (map println))
  (->> (-run-command "/Users/slim/docker/genai-stack/" "jimclark106" "darwin" "docker")
       (map :content)
       (map println)))
