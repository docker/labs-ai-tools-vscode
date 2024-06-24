(ns openai
  (:require
   [babashka.http-client :as http]
   [cheshire.core :as json]
   [clojure.java.io :as io]
   [clojure.string :as string]))

(defn openai-api-key []
  (try
    (string/trim (slurp (io/file (System/getenv "HOME") ".openai-api-key")))
    (catch Throwable _ nil)))

(defn openai [request cb]
  (println "## ROLE assistant")
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
      (throw (ex-info "Failed to call OpenAI API" response)) )))

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
                  (doseq [{{:keys [arguments] function-name :name} :function function-id :id} coll]
                    (println (format "... calling %s" function-name))
                    (function-handler
                      function-name
                      (json/parse-string arguments true)
                      {:resolve
                       (fn [output]
                         (println (format "## ROLE tool\n%s" output))
                         ;; add message with output to the conversation and call complete again
                         ;; add the assistant message that requested the tool be called
                         ;; {:tool_calls [] :role "assistant" :name "optional"}
                         ;; also ad the tool message with the response from the tool
                         ;; {:content "" :role "tool" :tool_call_id ""}

                         ;; this is also where we need to trampoline because we are potentially in a loop here
                         ;; in some ways we should probably just create channels and call these threads anyway
                         ;; I don't know how much we need a formal assistant api to make progress

                         )
                       :fail (fn [output]
                               (println (format "## ROLE tool\n function call %s failed %s" function-name output)))}))))
      (catch Throwable _))))

(comment
  (openai {:messages [{:content "What is the meaning of life?" :role "user"}]} chunk-handler))
