---
layout: blog
title: “K8s KPIs with Kuberhealthy”
date: 2020-05-18
---

**Authors:** Joshulyne Park (Comcast), Eric Greer (Comcast)

## K8s KPIs with Kuberhealthy

Last November at KubeCon San Diego 2019, we announced the release of 
[Kuberhealthy 2.0.0](https://www.youtube.com/watch?v=aAJlWhBtzqY) - transforming Kuberhealthy into a Kubernetes operator 
for synthetic monitoring. This new ability granted developers the means to create their own Kuberhealthy check 
containers to monitor their applications and clusters. The community was quick to adopt this new feature and we're 
grateful for everyone who implemented and tested Kuberhealthy 2.0.0 in their clusters. Thanks to all of you who reported 
issues and contributed to discussions on the #kuberhealthy Slack channel. We set to work to address all your feedback 
with a newer version of Kuberhealthy as well as provide a guide on how to install and use Kuberhealthy to capture cluster KPIs! 

#### Kuberhealthy Implementation

To install Kuberhealthy, make sure you have [Helm 3](https://helm.sh/docs/intro/install/) installed. If not, you can use the generated flat spec files located 
in this [deploy folder](../deploy). Make sure to use either the [kuberhealthy-prometheus.yaml](../deploy/kuberhealthy-prometheus.yaml) 
or [kuberhealthy-prometheus-operator.yaml](../deploy/kuberhealthy-prometheus-operator.yaml). 

To install using Helm 3:
1. Create namespace "kuberhealthy" in the desired Kubernetes cluster/context: 
  ```
  kubectl create namespace kuberhealthy
  ```
2. Set your current namespace to "kuberhealthy": 
  ```
  kubectl config set-context --current --namespace=kuberhealthy 
  ```
3. Add the kuberhealthy repo to Helm: 
  ```
  helm repo add kuberhealthy https://comcast.github.io/kuberhealthy/helm-repos
  ```
4. Install kuberhealthy:
  ```
  helm install kuberhealthy kuberhealthy/kuberhealthy 
  ```

Running the Helm command should automatically install Kuberhealthy 2.2.0. Running `kubectl get pods`, you should see two Kuberhealthy pods, and one check-reaper pod come up first. Running
`kubectl get khchecks`, you should see three Kuberhealthy checks installed by default:
- [daemonset](https://github.com/Comcast/kuberhealthy/tree/master/cmd/daemonset-check)
- [deployment](https://github.com/Comcast/kuberhealthy/tree/master/cmd/deployment-check)
- [dns-status-internal](https://github.com/Comcast/kuberhealthy/tree/master/cmd/dns-resolution-check)

To view other available external checks, check out the [external checks registry](https://github.com/Comcast/kuberhealthy/blob/master/docs/EXTERNAL_CHECKS_REGISTRY.md).
This registry should point to other other yaml files you can apply to your cluster to enable these checks. You can customize update your Helm values to enable other 
external checks. To update your helm values run with a custom `values.yaml`, run:

```.env
    helm upgrade --reuse-values -f values.yaml  prometheus-operator prometheus-operator/
```

Kuberhealthy check pods should start running a bit after Kuberhealthy starts running. The check-reaper cronjob ensures there are no more than 5 completed checker pods left lying around at a time.

To get status page view of these checks, you'll need to expose the Kuberhealthy service by editing the service `kuberhealthy` and setting `Type: LoadBalancer`. The service endpoint will display
a JSON status page: 

```json
{
    "OK": true,
    "Errors": [],
    "CheckDetails": {
        "kuberhealthy/daemonset": {
            "OK": true,
            "Errors": [],
            "RunDuration": "22.512278967s",
            "Namespace": "kuberhealthy",
            "LastRun": "2020-04-06T23:20:31.7176964Z",
            "AuthoritativePod": "kuberhealthy-67bf8c4686-mbl2j",
            "uuid": "9abd3ec0-b82f-44f0-b8a7-fa6709f759cd"
        },
        "kuberhealthy/deployment": {
            "OK": true,
            "Errors": [],
            "RunDuration": "29.142295647s",
            "Namespace": "kuberhealthy",
            "LastRun": "2020-04-06T23:20:31.7176964Z",
            "AuthoritativePod": "kuberhealthy-67bf8c4686-mbl2j",
            "uuid": "5f0d2765-60c9-47e8-b2c9-8bc6e61727b2"
        },
        "kuberhealthy/dns-status-internal": {
            "OK": true,
            "Errors": [],
            "RunDuration": "2.43940936s",
            "Namespace": "kuberhealthy",
            "LastRun": "2020-04-06T23:20:44.6294547Z",
            "AuthoritativePod": "kuberhealthy-67bf8c4686-mbl2j",
            "uuid": "c85f95cb-87e2-4ff5-b513-e02b3d25973a"
        }
    },
    "CurrentMaster": "kuberhealthy-7cf79bdc86-m78qr"
}
```
This JSON page displays all Kuberhealthy checks running in your cluster. If you have Kuberhealthy checks running in different namespaces, you can filter them by
using the `GET` variable `namespace` parameter: `?namespace=kuberhealthy,kube-system`.

#### Prometheus Integration

Kuberhealthy has an integration with Prometheus and the Prometheus Operator. To implement this, modify your Helm chart values to enable Prometheus. 
```.env
prometheus:
  enabled: true
  name: "prometheus"
  release: prometheus-operator
  enableScraping: true
  serviceMonitor: false
  enableAlerting: false
```
If you're using the Prometheus Operator, make sure to enable the serviceMonitor. This should automatically enable Kuberhealthy metrics to be scraped. 

When enabling Prometheus (not the operator), the Kuberhealthy service gets the following annotations added:
```.env
prometheus.io/path: /metrics
prometheus.io/port: "80"
prometheus.io/scrape: "true"
```

In your prometheus configuration, add the following example scrape_config that scrapes the Kuberhealthy service given the added prometheus annotation:

```      
- job_name: 'kuberhealthy'
  scrape_interval: 1m
  honor_labels: true
  metrics_path: /metrics
  kubernetes_sd_configs:
  - role: service
    namespaces:
      names:
        - kuberhealthy
  relabel_configs:
    - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
      action: keep
      regex: true
```
You can also specify the target endpoint to be scraped using this example: 
```
- job_name: kuberhealthy
  scrape_interval: 1m
  honor_labels: true
  metrics_path: /metrics
  static_configs:
    - targets:
      - kuberhealthy.kuberhealthy.svc.cluster.local:80
```

Once the appropriate prometheus configurations are applied, you should be able to see the following Kuberhealthy metrics:
- kuberhealthy_check 
- kuberhealthy_check_duration_seconds
- kuberhealthy_cluster_states
- kuberhealthy_running

#### K8s KPIs

Using these Kuberhealthy metrics, our team has been able to collect KPIs based on the following definitions, calculations, and PromQL queries.

*Availability*

We define availability as the K8s cluster control plane being up and functioning as expected. This is measured by whether or not we can communicate with the control plane API (kubectl) and the cluster responding appropriately to a given api query. 
We calculate this by measuring Kuberhealthy [deployment check](https://github.com/Comcast/kuberhealthy/tree/master/cmd/deployment-check) successes and failures. 
  - Availability = Uptime / (Uptime * Downtime)
  - Uptime = Number of Deployment Check Passes * Check Run Interval
  - Downtime = Number of Deployment Check Fails * Check Run Interval
  - Check Run Interval = how often the check runs (`runInterval` set in your KuberhealthyCheck Spec)
- PromQL Query (Availability % in the past 30 days): 
  ```
  1 - (sum(count_over_time(kuberhealthy_check{check="kuberhealthy/deployment", status="0"}[30d])) OR vector(0))/(sum(count_over_time(kuberhealthy_check{check="kuberhealthy/deployment", status="1"}[30d])) * 100)
  ```

*Utilization*

We define utilization as user uptake of product (k8s) and its resources (pods, services, etc.). This is measured by how many nodes, deployments, statefulsets, persistent volumes, services, pods, and jobs are being utilized by our customers.
We calculate this by counting the total number of nodes, deployments, statefulsets, persistent volumes, services, pods, and jobs.

*Duration (Latency)*

We define duration as the control plane's capacity and utilization of throughput. We calculate this by capturing the average run duration of a Kuberhealthy [deployment check](https://github.com/Comcast/kuberhealthy/tree/master/cmd/deployment-check) run.

- PromQL Query (Deployment check average duration, 1 hr step): 
  ```
  avg(kuberhealthy_check_duration_seconds{check="kuberhealthy/deployment"}) 
  ```

*Errors / Alerts*

We define errors as all k8s cluster and Kuberhealthy related alerts. Every time one of our Kuberhealthy check fails, we are alerted of this failure.


Thanks again to everyone in the community for all of your contributions and help! We hope this post was useful in adopting Kuberhealthy and 
we hope to keep hearing even more feedback from you soon!
