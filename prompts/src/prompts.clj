(ns prompts
  (:require
   [docker]
   [babashka.fs :as fs]
   [cheshire.core :as json]
   [clojure.java.io :as io]
   [clojure.pprint :refer [pprint]]
   [clojure.string :as string]
   [markdown.core :as markdown]
   [selmer.parser :as selmer.parser]))

(defn- facts [project-facts user platform]
  {:platform platform
   :username user
   :dockerfiles (->> project-facts
                     :project/dockerfiles
                     (map :path)
                     (string/join ", "))
   :composefiles (->> project-facts
                      :project/composefiles
                      (map :path)
                      (string/join ", "))
   :languages (->> project-facts
                   :github/linguist
                   keys
                   (map name)
                   (string/join ", "))
   :project-facts project-facts})

(defn- name-matches [re]
  (fn [p] (re-matches re (fs/file-name p))))

(defn- selma-render [m f]
  [{:content (selmer.parser/render (slurp f) m)} f])

(def prompt-file-pattern #".*_(.*)_.*.md")

(defn- merge-role [[m f]]
  (merge m {:role (let [[_ role] (re-find prompt-file-pattern (fs/file-name f))] role)}))

(defn fact-reducer [dir m container-definition]
  (try
    (docker/extract-facts container-definition dir)
    (catch Throwable e
      m)))

(defn collect-extractors [dir]
  [{:image "docker/lsp:latest"
    :entrypoint "/app/result/bin/docker-lsp"
    :command ["project-facts"
              "--vs-machine-id" "none"
              "--workspace" "/docker"]}])

(defn- -prompts [& args]
  (cond
    (= "prompts" (first args))
    [{:type "docker" :title "using docker in my project"}
     {:type "lazy_docker" :title "using lazy-docker"}
     #_{:type "ollama" :title "model quantization with Ollama"}
     #_{:type "git_hooks" :title "set up my git hooks"}
     #_{:type "harmonia" :title "using harmonia to access gpus"}]

    :else
    (let [[project-root user platform dir] args
          m (reduce (partial fact-reducer project-root) {} (collect-extractors dir))
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
  (markdown/parse-metadata (io/file "crap.md"))
  (markdown/md-to-meta (slurp (io/file "crap.md"))))

(defn -main [& args]
  (apply prompts args))

