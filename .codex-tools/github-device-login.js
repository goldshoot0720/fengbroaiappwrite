const fs = require('fs');
const path = require('path');
const readline = require('readline');

const clientId = '178c6fc778ccc68e1d6a';
const scope = 'repo read:org gist';
const configDir = path.join(process.cwd(), '.codex-tools', 'gh-config');
const loginDir = path.join(process.cwd(), '.codex-tools', 'gh-login');
fs.mkdirSync(configDir, { recursive: true });
fs.mkdirSync(loginDir, { recursive: true });

async function formPost(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'GitHub CLI',
    },
    body: new URLSearchParams(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json));
  return json;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

async function main() {
  const device = await formPost('https://github.com/login/device/code', {
    client_id: clientId,
    scope,
  });

  fs.writeFileSync(path.join(loginDir, 'device.json'), JSON.stringify({
    verification_uri: device.verification_uri,
    user_code: device.user_code,
    expires_in: device.expires_in,
    interval: device.interval,
  }, null, 2));

  console.log(`URL=${device.verification_uri}`);
  console.log(`CODE=${device.user_code}`);
  console.log(`EXPIRES_IN=${device.expires_in}`);
  console.log('WAITING_FOR_AUTHORIZATION');

  const started = Date.now();
  let interval = Number(device.interval || 5);
  while (Date.now() - started < Number(device.expires_in || 900) * 1000) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    const result = await formPost('https://github.com/login/oauth/access_token', {
      client_id: clientId,
      device_code: device.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    if (result.access_token) {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${result.access_token}`,
          'User-Agent': 'GitHub CLI',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      const user = await userResponse.json();
      if (!userResponse.ok) throw new Error(JSON.stringify(user));

      const hostsYaml = [
        'github.com:',
        `    oauth_token: ${yamlString(result.access_token)}`,
        '    git_protocol: https',
        `    user: ${yamlString(user.login)}`,
        '',
      ].join('\n');
      fs.writeFileSync(path.join(configDir, 'hosts.yml'), hostsYaml);
      fs.writeFileSync(path.join(loginDir, 'status.txt'), `logged-in:${user.login}\n`);
      console.log(`LOGGED_IN=${user.login}`);
      return;
    }

    if (result.error === 'authorization_pending') continue;
    if (result.error === 'slow_down') {
      interval += 5;
      continue;
    }
    if (result.error === 'expired_token') throw new Error('The GitHub device code expired.');
    if (result.error === 'access_denied') throw new Error('GitHub authorization was denied.');
    throw new Error(JSON.stringify(result));
  }
  throw new Error('Timed out waiting for GitHub authorization.');
}

main().catch((error) => {
  fs.writeFileSync(path.join(loginDir, 'status.txt'), `error:${error.message}\n`);
  console.error(error.message);
  process.exit(1);
});
