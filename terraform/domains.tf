# Maintain list of domains in Terraform state
resource "terraform_data" "domains" {
  input = var.domain
}

locals {
  # Get existing domains from state, or start with empty list
  existing_domains = try(tolist(terraform_data.domains.output), [])
  # Add new domain if it's not already in the list
  all_domains = toset(concat(local.existing_domains, [var.domain]))
}

# Output the list of domains for future reference
output "domains" {
  value = local.all_domains
} 