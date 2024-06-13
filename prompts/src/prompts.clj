(ns prompts
  (:require
   [babashka.fs :as fs]
   [cheshire.core :as json]
   [clojure.edn :as edn]
   [clojure.java.io :as io]
   [clojure.pprint :refer [pprint]]
   [clojure.string :as string]
   [docker]
   [git :as git]
   [markdown.core :as markdown]
   [medley.core :as medley]
   [pogonos.core :as stache]))

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

(defn fact-reducer [dir m container-definition]
  (try
    (medley/deep-merge
     m
     (docker/extract-facts container-definition dir))
    (catch Throwable _
      m)))

(defn collect-extractors [dir]
  (let [extractors (-> (markdown/parse-metadata (io/file dir "README.md")) first :extractors)]
    (if (seq extractors)
      extractors
      [{:image "docker/lsp:latest"
        :entrypoint "/app/result/bin/docker-lsp"
        :command ["project-facts"
                  "--vs-machine-id" "none"
                  "--workspace" "/docker"]}])))

(defn all-facts [project-root dir]
  (reduce (partial fact-reducer project-root) {} (collect-extractors dir)))

(def registry-file "/prompts/registry.edn")

(defn read-registry []
  (try
    (edn/read-string (slurp registry-file))
    (catch java.io.FileNotFoundException _
      {:prompts []})
    (catch Throwable t
      (binding [*out* *err*]
        (println "Warning (corrupt registry.edn): " (.getMessage t)))
      {:prompts []})))

(defn update-registry [f]
  (spit registry-file (pr-str (f (read-registry)))))

(defn- -prompts [& args]
  (cond
    (= "prompts" (first args))
    (concat
     [{:type "docker" :title "using docker in my project"}
      {:type "lazy_docker" :title "using lazy-docker"}
      {:type "npm_setup" :title "using npm"}
      #_{:type "ollama" :title "model quantization with Ollama"}
      #_{:type "git_hooks" :title "set up my git hooks"}
      #_{:type "harmonia" :title "using harmonia to access gpus"}]
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

    :else
    (let [[project-root user platform dir] args
          ;; TODO the docker default no longer makes sense here
          prompt-dir (or
                      (when (string/starts-with? dir "github") (git/prompt-dir dir))
                      dir
                      "docker")
          m (all-facts project-root prompt-dir)
          renderer (partial selma-render (facts m user platform))
          prompts (->> (fs/list-dir prompt-dir)
                       (filter (name-matches prompt-file-pattern))
                       (sort-by fs/file-name)
                       (into []))]
      (map (comp merge-role renderer fs/file) prompts))))

(comment
  (pprint
   (-prompts "/Users/slim/docker/labs-make-runbook" "jimclark106" "darwin" "github:docker/labs-make-runbook?ref=main&path=prompts/docker")))

(defn prompts [& args]
  (println
   (json/generate-string (apply -prompts args))))

(comment
  (-> (markdown/parse-metadata (io/file "docker/README.md")) first :extractors first keys)
  (markdown/md-to-meta (slurp (io/file "crap.md"))))

(defn -main [& args]
  (try
    (apply prompts args)
    (catch Throwable t
      (binding [*out* *err*]
        (println "Error:" (.getMessage t))
        (System/exit 1)))))

(comment
  (collect-extractors "npm")
  (all-facts "/Users/slim/docker/labs-make-runbook/" "npm_setup")
  (->> (-prompts "/Users/slim/docker/labs-make-runbook/" "jimclark106" "darwin" "npm_setup")
       (map :content)
       (map println))
  (->> (-prompts "/Users/slim/docker/genai-stack/" "jimclark106" "darwin" "docker")
       (map :content)
       (map println)))
