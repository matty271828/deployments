# Maintain list of domains in state
resource "terraform_data" "domains" {
  input = var.domain

  # This ensures the resource is updated when the domain list changes
  triggers_replace = {
    domains = jsonencode(concat(
      try(jsondecode(self.output), []),
      contains(try(jsondecode(self.output), []), var.domain) ? [] : [var.domain]
    ))
  }
}

locals {
  # Get the list of domains from the terraform_data resource
  domains = try(jsondecode(terraform_data.domains.triggers_replace.domains), [])
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
  value = try(jsondecode(terraform_data.domains.triggers_replace.domains), [])
  description = "List of domains that were already in state"
}

output "all_domains" {
  value = local.domains
  description = "Complete list of all domains after this run"
} 