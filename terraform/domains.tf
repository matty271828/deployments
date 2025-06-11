# Maintain list of domains in state
resource "terraform_data" "domains" {
  input = jsonencode(concat(try(jsondecode(terraform_data.domains.output), []), [var.domain]))
}

locals {
  # Get existing domains from state, or start with empty list
  existing_domains = try(jsondecode(terraform_data.domains.output), [])
  # Add new domain if it's not already in the list
  domains = toset(concat(local.existing_domains, [var.domain]))
}

# Output the list of domains for future reference
output "domains" {
  value = local.domains
} 