(ns openai
  (:require
   [babashka.http-client :as http]
   [cheshire.core :as json]
   [clojure.java.io :as io]
   [clojure.string :as string]))

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

(defn chunk-handler [function-handler chunk]
  (let [{:keys [delta message _finish_reason _role]}
        (some-> chunk
                (string/replace #"data: " "")
                (json/parse-string true)
                (get-in [:choices 0]))]

    ;; finish-reason will be :stop :length :tool_calls :content_filter :null
    (try
      (cond
        delta (do
                (print (:content delta))
                (flush))
        message (let [coll (:tool_calls message)]
                  (doseq [{{:keys [arguments] function-name :name} :function} coll]
                    (function-handler function-name (json/parse-string arguments true)))))
      (catch Throwable _))))

(comment
  (openai {:messages [{:content "What is the meaning of life?" :role "user"}]} chunk-handler))
