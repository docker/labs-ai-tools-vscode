(ns docker
  (:require
   [babashka.curl :as curl]
   [cheshire.core :as json]
   [clojure.pprint :refer [pprint]]))

;; check for 201
(defn create-container [{:keys [image entrypoint command host-dir]}]
  (let [payload (json/generate-string
                 {:Image image
                  :Tty true
                  :Entrypoint entrypoint
                  :HostConfig {:Binds [(format "%s:/project:ro" host-dir)
                                       "docker-lsp:/docker"]}
                  :Cmd command})]
    (curl/post
     "http://localhost/containers/create"
     {:raw-args ["--unix-socket" "/var/run/docker.sock"]
      :body payload
      :headers {"Content-Type" "application/json"
                "Content-Length" (count payload)}})))

(defn start-container [{:keys [Id]}]
  (curl/post
   (format "http://localhost/containers/%s/start" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]}))

;; check for 204
(defn delete-container [{:keys [Id]}]
  (curl/delete
   (format "http://localhost/containers/%s" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]}))

(defn attach-container [{:keys [Id]}]
  (curl/post
   (format "http://localhost/containers/%s/attach?stdout=true&logs=true" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]}))

;; should be 200 and then will have a StatusCode
(defn wait-container [{:keys [Id]}]
  (curl/post
   (format "http://localhost/containers/%s/wait?condition=not-running" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]}))

(defn ->json [response]
  (json/parse-string (:body response) keyword))

(defn status? [code s]
  (fn [response]
    (if (= code (:status response))
      response
      (throw (ex-info (format "%s should be %d" s code) response)))))

(def create (comp ->json (status? 201 "create-container") create-container))
(def start (comp (status? 204 "start-container") start-container))
(def wait (comp (status? 200 "wait-container") wait-container))
(def attach (comp (status? 200 "attach-container") attach-container))
(def delete (comp (status? 204 "delete-container") delete-container))

(def sample {:image "docker/lsp:latest"
             :entrypoint "/app/result/bin/docker-lsp"
             :command ["project-facts"
                       "--vs-machine-id" "none"
                       "--workspace" "/docker"]})

(defn extract-facts [container host-dir]
  (let [x (create (assoc container :host-dir host-dir))]
    (start x)
    (wait x)
    (let [json-string (:body (attach x))]
      (delete x)
      (json/parse-string json-string keyword))))

(comment
  (pprint (json/parse-string (extract-facts sample "/Users/slim/docker/genai-stack") keyword))
  )

