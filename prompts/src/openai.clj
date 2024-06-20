(ns openai
  (:require
   [babashka.http-client :as http]
   [cheshire.core :as json]
   [clojure.java.io :as io]
   [clojure.string :as string]
   [clojure.pprint :refer [pprint]]))

(defn openai-api-key [] 
  (try 
    (string/trim (slurp "/Users/slim/.openai-api-key"))
    (catch Throwable _ nil)))

(defn openai [request cb]
  (let [response
        (http/post
         "https://api.openai.com/v1/chat/completions"
         {:body (json/encode (merge
                              {:model "gpt-4"
                               :stream true}
                              request))
          :headers {"Authorization" (format "Bearer %s" (or 
                                                          (openai-api-key) 
                                                          (System/getenv "OPENAI_API_KEY")))
                    "Content-Type" "application/json"}
          :throw false
          :as :stream})]
    (if (= 200 (:status response))
      (if (false? (:stream request))
        (cb (slurp (:body response)))
        (doseq [chunk (line-seq (io/reader (:body response)))]
          (cb chunk)))
      (do
        (println response)
        (println (slurp (:body response)))
        (throw (ex-info "Failed to call OpenAI API" response))))))

(defn print-chunk [chunk]
  (try
    (some-> chunk
            (string/replace #"data: " "")
            (json/parse-string true)
            (get-in [:choices 0 :delta :content])
            (print))
    (flush)
    (catch Throwable _
      (println "\n" chunk))))

(defn print-functions [chunk]
  (let [coll (-> chunk
                 (json/parse-string true)
                 (get-in [:choices 0 :message :tool_calls]))]
    (doseq [{:keys [function]} coll]
      (try
        (println (format "** %s **" (:name function)))
        (pprint (json/parse-string (:arguments function)))
        (println (-> function :arguments json/parse-string (get "content")))
        (catch Throwable t
          (println "failed to parse function" function))))))

(comment
  (openai [{:content "What is the meaning of life?" :role "user"}] print-chunk))
