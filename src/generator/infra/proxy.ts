export const caddyfile = `{$DOMAIN:localhost} {
	encode zstd gzip

	reverse_proxy {$UPSTREAM:localhost:3000}

	header -Server

	log {
		output stdout
		format json
	}
}
`;

/** Rendered by the official nginx image's envsubst step (files in /etc/nginx/templates). */
export const nginxTemplate = `server {
    listen 80;
    server_name \${DOMAIN};

    server_tokens off;
    client_max_body_size 10m;

    gzip on;
    gzip_types application/json text/plain text/css application/javascript;

    location / {
        proxy_pass http://\${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
