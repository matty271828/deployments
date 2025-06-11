terraform {
  backend "local" {
    path = "domains.tfstate"
  }
}

# This file exists to maintain the list of domains in a separate state file
output "domains" {
  value = []  # Initial empty list
} 