locals {
  # Parse the domains JSON from the TF_VAR_domains_json variable
  domains = jsondecode(var.domains_json)
  
  # Create a map of domains for easier iteration
  domain_map = {
    for domain in local.domains : domain.domain => domain
  }

  # Create a map of frontend repos
  frontend_repos = {
    for domain in local.domains : domain.domain => {
      repo_name = split("/", domain.frontend_repo)[length(split("/", domain.frontend_repo)) - 1]
    }
  }
}

variable "domains_json" {
  description = "JSON string containing the list of domains and their frontend repos"
  type        = string
}