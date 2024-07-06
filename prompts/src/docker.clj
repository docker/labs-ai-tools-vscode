(ns docker
  (:require
   [babashka.curl :as curl]
   [cheshire.core :as json]
   [clojure.pprint :refer [pprint]]
   [clojure.spec.alpha :as spec]
   [creds])
  (:import
   [java.util Base64]))

(defn encode [to-encode]
  (.encodeToString (Base64/getEncoder) (.getBytes to-encode)))

;; https://index.docker.io/v1/ does not return IdentityTokens so we 
;; probably won't use this endpoint
#_{:clj-kondo/ignore [:clojure-lsp/unused-public-var]}
(defn auth
  [creds]
  (curl/post
   "http://localhost/auth"
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :body (json/generate-string creds)}))

(defn pull-image [{:keys [image identity-token creds]}]
  (curl/post
   (format "http://localhost/images/create?fromImage=%s" image)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :throw false
    :headers {"X-Registry-Auth"
              ;; I don't think we'll be pulling images
              ;; from registries that support identity tokens
              (-> (cond
                    identity-token {:identitytoken identity-token}
                    creds creds)
                  (json/generate-string)
                  (encode))}}))

(defn list-images [m]
  (curl/get
   "http://localhost/images/json"
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :query-params {:filters (json/generate-string m)}
    :throw false}))

(defn delete-image [{:keys [image]}]
  (curl/delete
   (format "http://localhost/images/%s?force=true" image)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :throw false}))

(defn container->archive [{:keys [Id path]}]
  (curl/get
   (format "http://localhost/containers/%s/archive?path=%s" Id path)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :throw false
    :as :stream}))

;; check for 201
(defn create-container [{:keys [image entrypoint command host-dir]}]
  (let [payload (json/generate-string
                 (merge
                  {:Image image
                   :Tty true}
                  (when host-dir {:HostConfig
                                  {:Binds [(format "%s:/project:rw" host-dir)
                                           "docker-lsp:/docker"]}
                                  :WorkingDir "/project"})
                  (when entrypoint {:Entrypoint entrypoint})
                  (when command {:Cmd command})))]
    (curl/post
     "http://localhost/containers/create"
     {:raw-args ["--unix-socket" "/var/run/docker.sock"]
      :throw false
      :body payload
      :headers {"Content-Type" "application/json"
                "Content-Length" (count payload)}})))

(defn inspect-container [{:keys [Id]}]
  (curl/get
   (format "http://localhost/containers/%s/json" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :throw false}))

(defn start-container [{:keys [Id]}]
  (curl/post
   (format "http://localhost/containers/%s/start" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :throw false}))

;; check for 204
(defn delete-container [{:keys [Id]}]
  (curl/delete
   (format "http://localhost/containers/%s" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :throw false}))

(defn attach-container [{:keys [Id]}]
  ;; logs is true (as opposed to stream=true) so we run this after the container has stopped
  ;; TTY is true above so this is the just the raw data sent to the PTY (not multiplexed)
  (curl/post
   (format "http://localhost/containers/%s/attach?stdout=true&logs=true" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :throw false}))

;; should be 200 and then will have a StatusCode
(defn wait-container [{:keys [Id]}]
  (curl/post
   (format "http://localhost/containers/%s/wait?condition=not-running" Id)
   {:raw-args ["--unix-socket" "/var/run/docker.sock"]
    :throw false}))

(defn ->json [response]
  (json/parse-string (:body response) keyword))

(defn status? [code s]
  (fn [response]
    (if (= code (:status response))
      response
      (throw (ex-info (format "%s -- (%d != %s)" s (:status response) code) response)))))

(def create (comp ->json (status? 201 "create-container") create-container))
(def inspect (comp ->json (status? 200 "inspect container") inspect-container))
(def start (comp (status? 204 "start-container") start-container))
(def wait (comp (status? 200 "wait-container") wait-container))
(def attach (comp (status? 200 "attach-container") attach-container))
(def delete (comp (status? 204 "delete-container") delete-container))
(def get-archive (comp (status? 200 "container->archive") container->archive))
(def pull (comp (status? 200 "pull-image") pull-image))
(def images (comp ->json list-images))

(def sample {:image "docker/lsp:latest"
             :entrypoint "/app/result/bin/docker-lsp"
             :command ["project-facts"
                       "--vs-machine-id" "none"
                       "--workspace" "/docker"]})

(spec/def ::host-dir string?)
(spec/def ::entrypoint string?)
(spec/def ::user string?)
(spec/def ::pat string?)
(spec/def ::image string?)
(spec/def ::command (spec/coll-of string?))
(spec/def ::container-definition (spec/keys :opt-un [::host-dir ::entrypoint ::command ::user ::pat]
                                           :req-un [::image]))

;; TODO verify that m is a container-definition
(defn run-function [m]
  (when (and (:user m) (or (:pat m) (creds/credential-helper->jwt))) 
    (pull (assoc m :creds {:username (:user m)
                           :password (or (:pat m) (creds/credential-helper->jwt))
                           :serveraddress "https://index.docker.io/v1/"})))
  (let [x (create m)]
    (start x)
    (wait x)
    ;; body is raw PTY output
    (let [s (:body (attach x))
          info (inspect x)]
      (delete x)
      {:pty-output s
       :exit-code (-> info :State :ExitCode)
       :info info})))

(def extract-facts run-function)

(comment
  (pprint 
    (json/parse-string 
      (extract-facts 
        (assoc sample 
               :host-dir "/Users/slim/docker/genai-stack"
               :user "jimclark106")) keyword))
  (docker/delete-image {:image "vonwig/go-linguist:latest"})
  (extract-facts {:image "vonwig/go-linguist:latest" 
                  :command ["-json"] 
                  :host-dir "/Users/slim/docker/labs-make-runbook"
                  :user "jimclark106"})
  (pprint
   (json/parse-string
    (extract-facts
     {:image "vonwig/extractor-node:latest"
      :host-dir "/Users/slim/docker/labs-make-runbook"})
    keyword)))

