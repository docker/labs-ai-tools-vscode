(ns init
  (:require
   [babashka.fs :as fs]))

(defn write [f path s]
  (spit (fs/file f path) s))

(defn -main []
  (apply write *command-line-args*))

(-main)

