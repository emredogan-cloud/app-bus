terraform {
  required_version = ">= 1.10.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}

locals {
  name = "${var.project}-${var.env}"
  tags = {
    Project     = var.project
    Environment = var.env
    ManagedBy   = "terraform"
    Compliance  = "kvkk"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

module "network" {
  source = "../../modules/network"

  name               = local.name
  cidr_block         = "10.10.0.0/16"
  azs                = slice(data.aws_availability_zones.available.names, 0, 3)
  single_nat_gateway = true
  tags               = local.tags
}

module "ecr" {
  source = "../../modules/ecr"

  name         = local.name
  repositories = ["api", "ingestion", "eta-engine"]
  tags         = local.tags
}

module "ecs" {
  source = "../../modules/ecs"
  name   = local.name
  tags   = local.tags
}

# App security group — apps in private subnets that need DB/Redis access.
resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "Application tasks (api, ingestion, eta-engine)"
  vpc_id      = module.network.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

module "rds" {
  source = "../../modules/rds"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.app.id]
  min_acu                    = 0.5
  max_acu                    = 2
  deletion_protection        = false
  tags                       = local.tags
}

module "redis" {
  source = "../../modules/redis"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.app.id]
  node_type                  = "cache.t4g.micro"
  tags                       = local.tags
}

module "secrets" {
  source = "../../modules/secrets"
  name   = local.name
  tags   = local.tags
}
