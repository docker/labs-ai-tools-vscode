(ns prompts
  (:require
   [docker]
   [babashka.fs :as fs]
   [cheshire.core :as json]
   [clojure.java.io :as io]
   [clojure.pprint :refer [pprint]]
   [clojure.string :as string]
   [markdown.core :as markdown]
   [pogonos.core :as stache]
   [medley.core :as medley]))

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
    (catch Throwable e
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

(defn- -prompts [& args]
  (cond
    (= "prompts" (first args))
    [{:type "docker" :title "using docker in my project"}
     {:type "lazy_docker" :title "using lazy-docker"}
     {:type "npm_setup" :title "using npm"}
     {:type "git_smoosh" :title "Smoosh changes into last commit"}
     #_{:type "ollama" :title "model quantization with Ollama"}
     #_{:type "git_hooks" :title "set up my git hooks"}
     #_{:type "harmonia" :title "using harmonia to access gpus"}]

    :else
    (let [[project-root user platform dir] args
          m (all-facts project-root dir)
          prompt-dir (or dir "docker")
          renderer (partial selma-render (facts m user platform))
          prompts (->> (fs/list-dir prompt-dir)
                       (filter (name-matches prompt-file-pattern))
                       (sort-by fs/file-name)
                       (into []))]
      (map (comp merge-role renderer fs/file) prompts))))

(comment
  (pprint
   (-prompts "{}" "jimclark106" "darwin")))

(defn prompts [& args]
  (println
   (json/generate-string (apply -prompts args))))

(comment
  (-> (markdown/parse-metadata (io/file "docker/README.md")) first :extractors first keys)
  (markdown/md-to-meta (slurp (io/file "crap.md"))))

(defn -main [& args]
  (apply prompts args))

(comment
  (collect-extractors "npm")
  (all-facts "/Users/slim/docker/labs-make-runbook/" "npm_setup")
  (->> (-prompts "/Users/slim/docker/labs-make-runbook/" "jimclark106" "darwin" "npm_setup")
       (map :content)
       (map println))
  (->> (-prompts "/Users/slim/docker/genai-stack/" "jimclark106" "darwin" "docker")
       (map :content)
       (map println)))
