data "digitalocean_ssh_key" "my_ssh_key" {
  name = var.digital_ocean_ssh_key_name
}

resource "digitalocean_project" "serverless" {
  name        = "multi-project"
  description = "Project for multi-project server"
  purpose     = "Web Application"
  environment = "Production"
}

resource "digitalocean_droplet" "multi-project-server" {
  count = 1
  image  = "ubuntu-24-10-x64"
  name   = "multi-project-server-001"
  region = "lon1"
  size   = "s-1vcpu-1gb-35gb-intel"
  ssh_keys = [data.digitalocean_ssh_key.my_ssh_key.id]
  project_id = digitalocean_project.serverless.id
} 