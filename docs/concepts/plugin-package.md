# Plugin package

O painel instala plugins por upload. Esta página descreve exatamente o que o arquivo enviado pode conter e o que o bot faz com ele.

## Enviando pelo painel

Abra a aba **Plugins**, preencha o `id` e escolha o arquivo em **.wasm ou .zip**, depois **Enviar**.

O `id` é o nome do plugin no `plugins/registry.json`. Use letras minúsculas, números e hífen, até 32 caracteres — `coin`, `daily-xp`, `welcome-2`.

O upload aceita duas formas:

| Arquivo | O que é lido |
| --- | --- |
| `coin.wasm` | O próprio arquivo, sem descompactar nada |
| `coin.zip` | Uma entrada `.wasm` de dentro do zip |

O resultado é sempre o mesmo: o painel grava `plugins/dist/<id>.wasm` e registra `{ id, wasm, permissions }` no registry. O nome do arquivo que você enviou não importa: o que manda é o `id` digitado no painel.

## Estrutura do zip

O zip precisa ter um `.wasm` na raiz — ou em qualquer pasta, mas com o nome igual ao `id` quando houver mais de um:

```text
coin.zip
├── coin.wasm          # obrigatório, é o que vai para plugins/dist/
├── README.md          # opcional, ignorado
├── LICENSE            # opcional, ignorado
└── docs/              # opcional, ignorado
    └── usage.md
```

Regras que o leitor aplica:

- **Um `.wasm` só.** Se o zip tiver dois ou mais, o nome precisa ser exatamente `<id>.wasm`. A mensagem de erro lista os candidatos e pede o rename.
- **Extensão `.wasm`, sem diferenciar maiúsculas.** `Coin.WASM` também é aceito.
- **O resto é ignorado.** README, licença, pasta `docs/`, `package.json`: nada disso é extraído. Só os bytes da entrada escolhida saem do zip, e o único caminho escrito é `plugins/dist/<id>.wasm`.
- **Compressão `store` ou `deflate`.** Qualquer outro método é recusado com o número do método.
- **Limites:** 32 MB para o corpo do upload e para o `.wasm` descompactado, 512 entradas no zip. Acima disso a resposta é `413 arquivo maior que o limite` ou `zip grande demais`.
- **Zip64 não é suportado.** Zips normais, gerados por `zip`, Finder, `Compress-Archive` e afins, funcionam.
- **O arquivo precisa ser WASM de verdade.** O leitor confere o magic `\0asm`; um `.txt` renomeado para `.wasm` é recusado antes de qualquer escrita.

### Exemplo

```sh
# compilar
pnpm plugins:build              # gera plugins/dist/coin.wasm

# empacotar com a documentação junto (opcional)
cd plugins/dist
zip -q /tmp/coin.zip coin.wasm README.md

# enviar pelo painel: id "coin", arquivo /tmp/coin.zip
```

## O que o bot faz com o arquivo

1. Lê o upload inteiro em memória e valida o magic.
2. Grava `plugins/dist/<id>.wasm`.
3. Atualiza `plugins/registry.json` e recarrega os plugins em memória.
4. Mostra no card o que carregou: versão, comandos e as permissões que o WASM importa.

O painel nunca compila o que você envia. Se o plugin depende de uma permissão (`kv`, `xp.grant`, `http`) e ela não está marcada, o arquivo fica instalado mas o card mostra `faltam ...`. Marque a caixa para liberar. `http` ainda exige os hosts em `allowedHosts`.

Se o WASM não puder ser lido, ou se os comandos dele colidirem com um comando embutido ou de outro plugin, a instalação é desfeita: o `.wasm` anterior e o registry voltam ao que eram, e a resposta traz o motivo entre parênteses.

## Reenviar o mesmo `id`

Enviar de novo com o mesmo `id` é como se publica uma versão nova: o arquivo é substituído e as permissões já concedidas são mantidas, a menos que o upload traga `?permissions=` explícito.

## Plugin sem upload

O repositório também aceita plugins colocados à mão: ponha o `.wasm` em `plugins/dist/` e descreva o plugin em `plugins/registry.json`. O painel também lista esses, e o botão **Compilar** refaz o WASM a partir de `plugins/<id>-go` ou `plugins/<id>-rust` quando a toolchain está instalada na máquina do bot.

## Ver também

- [plugins](plugins.md) — contrato do WASM, comandos e permissões.
- [getting started](../getting-started.md) — scripts, incluindo `pnpm deploy-plugins`.
