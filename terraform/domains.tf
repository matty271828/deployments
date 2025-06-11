# Maintain list of domains in state
resource "terraform_data" "domains" {
  input = var.domain
}

locals {
  # Get existing domains from state, or start with empty list
  existing_domains = try(tolist(terraform_data.domains.output), [])
  # Add new domain if it's not already in the list
  domains = toset(concat(local.existing_domains, [var.domain]))
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
  value = local.existing_domains
  description = "List of domains that were already in state"
}

output "all_domains" {
  value = local.domains
  description = "Complete list of all domains after this run"
} 