# Maintain list of domains in state
resource "terraform_data" "current_domain" {
  input = var.domain
}

resource "terraform_data" "domain_list" {
  input = jsonencode(concat(
    try(jsondecode(terraform_data.domain_list.output), []),
    contains(try(jsondecode(terraform_data.domain_list.output), []), var.domain) ? [] : [var.domain]
  ))
}

locals {
  # Get the list of domains from the terraform_data resource
  domains = try(jsondecode(terraform_data.domain_list.output), [])
}

# Output the list of domains for future reference
output "domains" {
  value = local.domains
}

# Additional outputs for better visibility in GitHub Actions
output "current_domain" {
  value = var.domain
  description = "The domain being added in this run"
}

output "existing_domains" {
  value = try(jsondecode(terraform_data.domain_list.output), [])
  description = "List of domains that were already in state"
}

output "all_domains" {
  value = local.domains
  description = "Complete list of all domains after this run"
} 