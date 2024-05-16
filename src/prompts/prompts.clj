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
  {:content (selmer.parser/render (slurp f) m)})

(defn- merge-role [s]
  (fn [m]
    (merge m {:role s})))

(defn- -prompts [& args]
  (let [[project-facts user platform dir] args
        m (json/parse-string project-facts keyword)
        prompt-dir (or dir "v1")
        renderer (partial selma-render (facts m user platform))
        system-prompts (->> (fs/list-dir (fs/file prompt-dir))
                            (filter (name-matches #".*_system_.*.txt"))
                            (sort-by fs/path)
                            (into []))
        user-prompts (->> (fs/list-dir prompt-dir)
                          (filter (name-matches #".*_user_.*.txt"))
                          (sort-by fs/path)
                          (into []))]
    (concat
     (map (comp (merge-role "system") renderer fs/file) system-prompts)
     (map (comp (merge-role "user") renderer fs/file) user-prompts))))

(comment
  (pprint
   (-prompts "{}" "jimclark106" "darwin")))

(defn prompts [& args]
  (println
   (json/generate-string (apply -prompts args))))

(apply prompts *command-line-args*)

