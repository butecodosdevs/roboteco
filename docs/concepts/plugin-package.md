# Plugin package

O painel **não** instala plugins: ele lista o que está em `plugins/registry.json`, liga/desliga comandos e mostra o uso. Instalar é no repositório, com dois arquivos:

```sh
pnpm plugins:build              # gera plugins/dist/<id>.wasm a partir de plugins/<id>-go ou -rust
```

| Onde | O que é |
| --- | --- |
| `plugins/dist/<id>.wasm` | O binário. Fica fora do git (`.gitignore`), por isso precisa ser compilado em cada máquina. |
| `plugins/registry.json` | Uma entrada `{ id, wasm, enabled, permissions, allowedHosts? }` por plugin. |

```json
{
  "plugins": [
    { "id": "coin", "wasm": "plugins/dist/coin.wasm", "enabled": true, "permissions": ["kv"] }
  ]
}
```

O `id` é o nome do plugin: letras minúsculas, números e hífen, até 32 caracteres — `coin`, `daily-xp`, `welcome-2`.

## O que o bot faz

1. Lê `registry.json` no boot.
2. Carrega o `.wasm` de cada entrada com `enabled: true`.
3. Confere as permissões que o WASM importa contra a lista `permissions`; o que faltar aparece no card como `faltam ...`.
4. Publica os comandos no Discord (`pnpm deploy-plugins`, ou o botão **Publicar no Discord** no painel).

Se o WASM não puder ser lido, ou se os comandos dele colidirem com um comando embutido ou de outro plugin, o plugin não carrega e o card mostra o motivo. O resto continua funcionando.

## Atualizar uma versão

Recompile com `pnpm plugins:build`, suba o novo `.wasm` para `plugins/dist/` e clique em **Recarregar** no painel. As permissões já concedidas no registry são mantidas.

## Ver também

- [plugins](plugins.md) — contrato do WASM, comandos e permissões.
- [getting started](../getting-started.md) — scripts, incluindo `pnpm deploy-plugins`.
