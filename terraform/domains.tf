# Maintain list of domains in Terraform state
resource "terraform_data" "domains" {
  input = var.domain
}

locals {
  all_domains = toset(concat([var.domain], try(tolist(terraform_data.domains.output), [])))
}

# Output the list of domains for future reference
output "domains" {
  value = local.all_domains
} 