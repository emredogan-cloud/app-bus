terraform {
  backend "s3" {
    bucket         = "app-bus-tfstate"
    key            = "envs/dev/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "app-bus-tflock"
    encrypt        = true
  }
}
