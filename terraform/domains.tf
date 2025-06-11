# Try to get existing domains from remote state
data "terraform_remote_state" "domains" {
  backend = "local"
  config = {
    path = "${path.module}/terraform.tfstate"
  }
}

locals {
  # If state exists, use it plus new domain. If not, just use new domain
  existing_domains = try(tolist(data.terraform_remote_state.domains.outputs.domains), [])
  all_domains = toset(concat([var.domain], local.existing_domains))
}

# Output the list of domains for future reference
output "domains" {
  value = local.all_domains
} 