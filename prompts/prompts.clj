(ns prompts
  (:require
   [cheshire.core :as json]
   [babashka.fs :as fs]
   [clojure.pprint :refer [pprint]]
   [selmer.parser :as selmer.parser]
   [clojure.string :as string]))

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

(def prompt-file-pattern #".*_(.*)_.*.txt")

(defn- merge-role [[m f]]
  (merge m {:role (let [[_ role] (re-find prompt-file-pattern (fs/file-name f))] role)}))

(defn- -prompts [& args]
  (let [[project-facts user platform dir] args
        m (json/parse-string project-facts keyword)
        prompt-dir (or dir "docker")
        renderer (partial selma-render (facts m user platform))
        prompts (->> (fs/list-dir prompt-dir)
                     (filter (name-matches prompt-file-pattern))
                     (sort-by fs/file-name)
                     (into []))]
    (map (comp merge-role renderer fs/file) prompts)))

(comment
  (pprint
   (-prompts "{}" "jimclark106" "darwin")))

(defn prompts [& args]
  (println
   (json/generate-string (apply -prompts args))))

(apply prompts *command-line-args*)

