(ns openai
  (:require
   [babashka.http-client :as http]
   [cheshire.core :as json]
   [clojure.core.async :as async]
   [clojure.java.io :as io]
   [clojure.string :as string]
   [jsonrpc]))

(defn openai-api-key []
  (try
    (string/trim (slurp (io/file (System/getenv "HOME") ".openai-api-key")))
    (catch Throwable _ nil)))

(defn openai [request cb]
  (jsonrpc/notify :message {:content "## ROLE assistant\n"})
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
      (throw (ex-info "Failed to call OpenAI API" response)))))

(defn parse [s]
  (if (= "[DONE]" (string/trim s))
    {:done true}
    (json/parse-string s true)))

(defn call-function [function-handler function-name arguments]
  (function-handler
   function-name
   (json/parse-string arguments true)
   {:resolve
    (fn [output]
      (jsonrpc/notify :message {:content (format "## ROLE tool\n%s\n" output)})
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
            (jsonrpc/notify :message {:content (format "## ROLE tool\n function call %s failed %s" function-name output)}))}))

(defn make-tool-calls [function-handler tool-calls]
  (doseq [{{:keys [arguments name]} :function _function-id :id} tool-calls]
    (jsonrpc/notify :message {:content (format "\n... calling %s\n" name)})
    (call-function function-handler name arguments)))

(defn function-merge [m {:keys [name arguments]}]
  (cond-> m
    name (assoc :name name)
    arguments (update :arguments str arguments)))

(defn update-tool-calls [m tool-calls]
  (reduce
   (fn [m {:keys [index id function]}]
     (update-in m [:tool-calls index :function]
                (fnil function-merge {}) (merge function
                                                (when id {:id id}))))
   m tool-calls))

(comment
  (reduce
   (partial update-tool-calls "guid")
   {}
   [[{:id "fid" :function {:name "echo"}}]
    [{:id "fid" :function {:arguments "some"}}]
    [{:id "fid" :function {:arguments " stuff"}}]]))

#_{:clj-kondo/ignore [:clojure-lsp/unused-public-var]}
(def finish-reasons
  {:stop "stopped normally"
   :length "max response length reached"
   :tool_calls "making tool calls"
   :content_filter "content filter applied"
   :not_specified "not specified"})

(defn response-loop [c]
  (let [response (atom {})]
    (async/go-loop
     []
      (let [e (async/<! c)]
        (cond
          (:done e) (let [{calls :tool-calls} @response]
                      (jsonrpc/notify :functions-done (vals calls))
                      (jsonrpc/notify :message {:content "\n---\n\n"})
                      (make-tool-calls
                       (:tool-handler e)
                       (->> calls
                            (map (fn [[id v]]
                                   (assoc v :index id))))))
          :else (let [{:keys [tool_calls]} e]
                  (swap! response update-tool-calls tool_calls)
                  (jsonrpc/notify :functions (->> @response :tool-calls vals))
                  (recur)))))))

(defn chunk-handler [function-handler]
  (let [c (async/chan 1)]
    [(response-loop c)
     (fn [chunk]
       (let [{[{:keys [delta message finish_reason _role]}] :choices
              done? :done _completion-id :id}
             ;; only streaming events will be SSE data fields
             (some-> chunk
                     (string/replace #"data: " "")
                     (parse))]
         (try
           (cond
             done? (async/>!!
                     c
                     {:done true :finish-reason finish_reason :tool-handler function-handler})
             delta (cond
                     (:content delta) (jsonrpc/notify :message {:content (:content delta)})
                     (:tool_calls delta) (async/>!!
                                           c
                                           delta))

             message (cond
                       (:content message) (jsonrpc/notify :message {:content (:content message)})
                       (:tool_calls message) (make-tool-calls function-handler (:tool_calls message))))
           (catch Throwable _))))]))

(comment
  (openai
   {:messages [{:content "What is the meaning of life?" :role "user"}]}
   (second (chunk-handler (fn [& args] (println args)))))
  (openai
   {:messages [{:content "use a function to echo back to me a 10 line poem" :role "user"}]
    :tools [{:type "function"
             :function {:name "echo"
                        :description "echo something back to me"
                        :parameters
                        {:type "object"
                         :properties
                         {:content {:type "string"
                                    :description "the content to echo back"}}}}}]}
   (second (chunk-handler (fn [& args]
                            (println "function-handler " args))))))
