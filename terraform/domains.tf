# Read domains from file
data "local_file" "domains" {
  filename = "${path.root}/../domains.txt"
}

locals {
  domains = split("\n", data.local_file.domains.content)
}

# Output the list of domains for future reference
output "domains" {
  value = local.domains
}

output "current_domain" {
  value = var.domain
  description = "The domain being added in this run"
}

output "all_domains" {
  value = local.domains
  description = "Complete list of all domains"
} 