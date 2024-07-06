(ns clean-local-images
  (:require [docker]
            [clojure.pprint :refer [pprint]]))

(def images
  #{"vonwig/prompts"
    "vonwig/function_write_file"
    "vonwig/docker_scout_tag_recommendation"
    "vonwig/extractor-node"
    "vonwig/go-linguist"
    "vonwig/codescope"
    "vonwig/pre-commit"
    "markdownlint/markdownlint"
    "hadolint/hadolint"
    "docker/lsp"})

(comment
  (docker/delete-image {:image "vonwig/function_write_files"}))

(defn repo? [images]
  (fn [tag-or-digest]
    (some (fn [image] (.startsWith tag-or-digest image)) images)))

(defn -main []
  (->> (docker/images {})
       #_(map #(concat (:RepoTags %) (:RepoDigests %)))
       (filter #(some (repo? images) (concat (:RepoTags %) (:RepoDigests %))))
       (map :Id)
       (map #(docker/delete-image {:image %}))))

(-main)

(comment
  (pprint (docker/images {}))
  )

