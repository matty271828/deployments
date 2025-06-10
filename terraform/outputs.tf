output "droplet_ip" {
  value = digitalocean_droplet.multi-project-server[0].ipv4_address
}