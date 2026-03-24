DOCKER_USERNAME ?= aimerite
IMAGE_TAG ?= latest
IMAGE_NAME = $(DOCKER_USERNAME)/whodb

image-build:
	docker build -f core/Dockerfile -t $(IMAGE_NAME):$(IMAGE_TAG) .

image-push:
	docker push $(IMAGE_NAME):$(IMAGE_TAG)

image-build-push: image-build image-push
