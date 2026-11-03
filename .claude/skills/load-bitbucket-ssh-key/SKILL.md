---
name: load-bitbucket-ssh-key
description: Restore and verify SSH authentication with Bitbucket on macOS by loading the existing key through SSH/Keychain. Use when the user asks to update or load the SSH key, or when Git, a push, or a PR tool fails with Permission denied (publickey) while connecting to git@bitbucket.org. Does not generate or rotate keys and does not resolve connectivity, host trust, or repository permission errors.
---

# Load and Verify the Bitbucket SSH Key

## Scope

In this environment, "update the key" means loading the existing identity `~/.ssh/id_ed25519_bitbucket` into the SSH agent and verifying authentication with `git@bitbucket.org`. Execute the procedure using the available terminal.

Loading the key affects the agent for the current session; it does not guarantee that the identity will remain loaded after logging out, restarting, or switching agents. Do not attribute recurring failures to key expiration or revocation without evidence.

## Restrictions

- Do not generate, overwrite, delete, or rotate keys; do not modify `~/.ssh/config`, Git configuration, or Bitbucket credentials.
- Do not read or display the private key, tokens, or passphrases. If SSH/Keychain requests the passphrase, the user must enter it through a secure mechanism, never in chat or as a command argument.
- Preserve host verification. Do not accept unknown fingerprints or disable `StrictHostKeyChecking`.
- Respect terminal permissions. Request the appropriate privilege escalation to access the agent, Keychain, or network; do not bypass a denial. If automatic approval fails, report that the action was not executed and explain why.
- This request authorizes only this recovery procedure; it does not authorize cloning, fetching, pushing, deploying, or installing or configuring the agent persistently.

## Procedure

Execute the steps in order and inspect the output of each before proceeding.

### 1. Check Authentication

```sh
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -T git@bitbucket.org
```

- If Bitbucket confirms `authenticated via ssh key`, report success. The message indicating that interactive shell access is unavailable is normal; there is no need to reload the key.
- If it returns `Permission denied (publickey)`, proceed to agent diagnostics.
- If a DNS error, connection error, unknown or changed host, or ambiguous output occurs, stop and report it; do not assume that the identity needs to be loaded. If the tool explicitly indicates a sandbox restriction, repeat the check only through the corresponding authorized privilege escalation.

### 2. Check Key Existence and Loaded Identities

Without reading the private key:

```sh
if test -f "$HOME/.ssh/id_ed25519_bitbucket"; then
  echo identity_exists
else
  echo identity_missing
fi
ssh-add -l
```

Interpret both results separately:

- `identity_missing`: Stop; do not create another key.
- `The agent has no identities.`: If the key exists, proceed to loading it.
- If identities are already loaded, compare their fingerprints against the existing public key:

  ```sh
  ssh-keygen -lf "$HOME/.ssh/id_ed25519_bitbucket.pub"
  ```

  If the fingerprint already appears in `ssh-add -l` and Bitbucket rejected authentication, stop and report that reloading the key is not the appropriate recovery action. If the fingerprint is absent, proceed to loading the key. If the public key file is missing or the comparison is inconclusive, stop and explain the uncertainty.
- If no SSH agent is accessible or a required tool is missing, stop; do not start an alternative agent or install tools as part of this recovery procedure.

### 3. Load the Existing Identity Once

```sh
ssh-add --apple-use-keychain "$HOME/.ssh/id_ed25519_bitbucket"
```

Proceed only if the key loads successfully. If loading fails or a passphrase prompt cannot be handled securely, stop and report what remains unresolved.

### 4. Verify Recovery

Repeat the authentication command from Step 1. Declare success only if Bitbucket confirms authentication; `Identity added` alone is not sufficient.

If authentication is still rejected, stop without retrying the load operation or changing configuration.

If the user specifically asks to verify that **this particular key is loaded**, run `ssh-add -l` and `ssh-keygen -lf` against its `.pub` file, and confirm that the fingerprints match. Successful authentication to the service alone does not identify which key was used when multiple keys are configured.

## User-Facing Result

Briefly report whether the identity was loaded or authentication was already working, along with the final verification result.

Example after successful loading and verification:

> I loaded the existing key through Keychain, and Bitbucket confirmed SSH authentication.

If any step fails, explain what was checked and what remains unresolved; do not claim success.

The verification confirms authentication to the service, not read or write permissions for a specific repository.
