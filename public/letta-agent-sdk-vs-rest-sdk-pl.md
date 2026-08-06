# Letta Agent SDK, MemFS i różnice względem klasycznego REST SDK

> Stan dokumentacji: 6 sierpnia 2026 r.  
> Zakres: Letta Agent SDK (`@letta-ai/letta-agent-sdk`) w porównaniu z klasycznym Letta REST API i generowanymi klientami SDK, np. Python `letta-client`.

## Najkrótsza odpowiedź

Letta Agent SDK nie jest po prostu nową wersją starego klienta REST. Oba interfejsy działają na różnych poziomach abstrakcji:

- **REST API / klasyczne SDK** służy przede wszystkim do zarządzania zasobami Letta Cloud i wykonywania operacji API: agentami, wiadomościami, blokami pamięci, narzędziami, archiwami i innymi rekordami serwerowymi.
- **Letta Agent SDK** uruchamia i kontroluje pełny agent harness: aktywną sesję agenta, środowisko wykonawcze, narzędzia komputerowe, MemFS, skills, subagentów, approvals i strumień zdarzeń runtime.

Najczęściej nie trzeba wybierać wyłącznie jednego z nich. REST SDK może pełnić rolę **control plane**, a Agent SDK — **execution plane**.

## Model mentalny

Klasyczne wywołanie REST wygląda koncepcyjnie tak:

```text
aplikacja -> HTTPS -> Letta API -> agent/run -> odpowiedź
```

Agent SDK steruje pełnym runtime:

```text
aplikacja
  -> Letta Agent SDK
    -> Cloud managed sandbox / Local App Server / Remote App Server
      -> Letta Code harness
        -> model
        -> MemFS
        -> built-in tools
        -> skills i subagenci
        -> client tools i MCP
```

Agent SDK jest więc kontrolerem działającego agenta, a nie tylko klientem HTTP do jego rekordów.

## Porównanie techniczne

| Obszar | Klasyczne REST SDK | Letta Agent SDK |
|---|---|---|
| Główna abstrakcja | Zasoby API: agent, block, tool, message, archive | Agent + conversation + aktywna session + runtime |
| Transport | HTTP request/response; osobny endpoint streamingu | Długotrwała sesja; pod spodem Cloud transport lub jeden dwukierunkowy WebSocket App Server |
| Model wykonania | „Wywołaj endpoint agenta” | „Uruchom runtime, podłącz narzędzia, wysyłaj tury i odbieraj zdarzenia” |
| Środowisko wykonawcze | Nie jest główną abstrakcją klienta | Jawnie wybierane: Cloud sandbox, Local lub Remote App Server |
| Pamięć | Memory blocks, archives i inne zasoby API | MemFS jako gitowy filesystem agenta; blocks nadal mogą być użyte przy tworzeniu |
| Narzędzia | Narzędzia przechowywane lub wykonywane po stronie serwera | Pełny toolset harnessu oraz sesyjne client tools/MCP hostowane przez aplikację |
| Streaming | Strumień odpowiedzi pojedynczego requestu | Assistant, reasoning, tool calls, queue, retry, errors, approvals i result |
| Approvals | Operacje i wiadomości API | Interaktywny `canUseTool` oraz odzyskiwanie pending approvals po reconnect |
| Kolejka | Oddzielne requesty/runy | Kolejne `send()` mogą być kolejkowane podczas aktywnej tury |
| Lifecycle | Klient HTTP jest przeważnie bezstanowy | Sesję należy otworzyć, utrzymać, ewentualnie odzyskać i zamknąć |
| Języki | REST/curl oraz generowane SDK, m.in. Python | Wysokopoziomowe SDK: TypeScript/JavaScript; Python może użyć protokołu App Server bezpośrednio |
| Najlepsze zastosowanie | Administracja i CRUD zasobów Cloud | Aplikacja oparta na pełnym, działającym agencie |

## Agent, conversation i session

Agent SDK rozdziela trzy pojęcia:

- **agent** — trwała tożsamość, konfiguracja i pamięć;
- **conversation** — trwały wątek wiadomości danego agenta;
- **session** — aktywne połączenie do runtime wykonującego pracę.

Przykład:

```ts
import { LettaAgentClient } from "@letta-ai/letta-agent-sdk";

const client = new LettaAgentClient({
  backend: "cloud",
  apiKey: process.env.LETTA_API_KEY,
});

// Nowa rozmowa na istniejącym agencie.
await using newConversation = client.createSession("agent-...");

// Wznowienie konkretnej istniejącej rozmowy.
await using exactConversation = client.resumeSession("conv-...");

// Wznowienie głównej/default conversation agenta.
await using mainConversation = client.resumeSession("agent-...");
```

Sandbox lub połączenie może zostać zakończone, ale agent, conversation i zsynchronizowany MemFS pozostają trwałe.

## Podstawowe użycie Agent SDK

```bash
npm install @letta-ai/letta-agent-sdk
```

```ts
import { LettaAgentClient } from "@letta-ai/letta-agent-sdk";

const client = new LettaAgentClient({
  backend: "cloud",
  apiKey: process.env.LETTA_API_KEY,
});

await using session = client.resumeSession("agent-...");

await session.send(
  "Przeanalizuj zadanie, wykonaj potrzebną pracę i zapisz trwałe wnioski w pamięci.",
);

for await (const event of session.stream()) {
  if (event.type === "reasoning") {
    console.log("reasoning:", event.content);
  }

  if (event.type === "tool_call") {
    console.log("tool:", event.toolName, event.toolInput);
  }

  if (event.type === "assistant") {
    console.log(event.content);
  }

  if (event.type === "result" && !event.success) {
    console.error(event.errorDetail ?? event.error);
  }
}
```

SDK udostępnia również m.in.:

```ts
session.abort();
session.listMessages();
session.listModels();
session.updateModel();
session.bootstrapState();
session.recoverPendingApprovals();
session.removeQueuedMessage();
session.changeDeviceState();
session.getDeviceStatus();
```

## Trzy modele wdrożenia

Agent SDK używa jednego interfejsu dla trzech środowisk.

### 1. Letta Cloud

```ts
const client = new LettaAgentClient({
  backend: "cloud",
  apiKey: process.env.LETTA_API_KEY,
});
```

- stan agenta, conversations i MemFS pozostają w Letta Cloud;
- jeśli nie wybierzesz innego środowiska, SDK uruchamia managed Cloud sandbox;
- sandbox wykonuje shell, narzędzia i operacje na plikach;
- nie musisz utrzymywać własnego VPS-a.

### 2. Local

```ts
const client = new LettaAgentClient({ backend: "local" });
```

- SDK uruchamia lokalny App Server;
- stan, filesystem i wykonanie pozostają na maszynie aplikacji;
- przydatne dla agentów lokalnych i prywatnych projektów.

### 3. Remote App Server

```ts
const client = new LettaAgentClient({
  backend: "remote",
  url: "https://runtime.example.com",
  authToken: process.env.LETTA_APP_SERVER_TOKEN,
});
```

- sam utrzymujesz runtime, np. na VPS-ie;
- App Server może używać lokalnego albo Cloud backendu;
- przydatne dla prywatnych sieci, specjalnego sprzętu lub długowiecznych środowisk.

## Jak działa MemFS w Cloud sandboxie

MemFS należy do agenta, a nie do konkretnego sandboxa. Dla Cloud agenta typowy cykl wygląda tak:

1. Sesja uruchamia lub wznawia managed sandbox.
2. Harness klonuje albo pobiera (`pull`) repozytorium MemFS agenta do lokalnego working tree w sandboxie.
3. Agent czyta i edytuje pliki pod `$MEMORY_DIR`.
4. Zmiany pamięci są commitowane do lokalnego repozytorium Git.
5. Harness automatycznie wysyła (`push`) czyste, commitowane zmiany do zdalnego MemFS w Letta Cloud po turze.
6. Inny runtime lub przyszły sandbox pobiera aktualny stan.

Agent nie edytuje zatem abstrakcyjnego zdalnego filesystemu bezpośrednio przy każdej operacji. Pracuje na lokalnym checkoutcie, a Git zapewnia wersjonowanie i synchronizację.

Należy odróżnić:

- **stan sandboxa** — pliki projektu, zależności, lokalne checkouty i pozostały filesystem;
- **stan agenta** — identity, conversations i MemFS przechowywane niezależnie od sandboxa.

Cloud sandbox ma własny filesystem i może pozostać dostępny po zakończeniu sesji do wygaśnięcia TTL. Agent SDK pozwala kontrolować m.in. TTL, częstotliwość odświeżania i zachowanie przy zamknięciu:

```ts
const client = new LettaAgentClient({
  backend: "cloud",
  apiKey: process.env.LETTA_API_KEY,
  sandbox: {
    ttlMinutes: 5,
    readyTimeoutMs: 120_000,
    readyPollIntervalMs: 1_000,
    refreshIntervalMs: 240_000,
    terminateOnClose: false,
  },
});
```

Stanowego sandboxa nie należy jednak traktować jako jedynego backupu. Trwałość MemFS jest celowo oddzielona od cyklu życia środowiska wykonawczego.

## Memory blocks a MemFS

Memory blocks nie zniknęły. Przy tworzeniu agenta Agent SDK może przyjąć np.:

```ts
const agentId = await client.createAgent({
  memory: [
    {
      label: "persona",
      value: "Jesteś analitykiem produktu.",
    },
    {
      label: "human",
      value: "Użytkownik preferuje krótkie raporty z dowodami.",
    },
  ],
});
```

Różnica polega na reprezentacji i sposobie pracy:

- blocks są rekordami zarządzanymi przez API;
- MemFS jest gitowym drzewem Markdown, które agent może sam czytać, modyfikować i reorganizować;
- pliki w `system/` są przypinane do system promptu;
- szczegółowe materiały poza `system/` mogą być czytane na żądanie;
- skills należące do agenta mogą żyć pod `$MEMORY_DIR/skills`.

## Client tools

Agent SDK może zarejestrować funkcje należące do aplikacji jako narzędzia sesyjne:

```ts
const lookupCustomer = {
  name: "lookup_customer",
  label: "Look up customer",
  description: "Pobierz klienta z wewnętrznej bazy danych.",
  parameters: {
    type: "object",
    properties: {
      customerId: { type: "string" },
    },
    required: ["customerId"],
  },
  async execute(_toolCallId, input, signal) {
    const response = await fetch(
      `https://internal.example.com/customers/${input.customerId}`,
      { signal },
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(await response.json()),
        },
      ],
    };
  },
};

await using session = client.resumeSession("agent-...", {
  tools: [lookupCustomer],
  allowedTools: ["lookup_customer", "Read", "Grep"],
});
```

Ważne właściwości:

- implementacja wykonuje się w procesie Node hostującym Agent SDK;
- sekrety i połączenia mogą pozostać po stronie aplikacji;
- narzędzie jest związane z sesją i nie jest automatycznie zapisywane na agencie;
- agent otrzymuje schemat narzędzia, a wykonanie wraca do kontrolera SDK.

## MCP

Agent SDK obsługuje sesyjne serwery MCP:

- stdio,
- Streamable HTTP,
- legacy SSE.

```ts
await using session = client.resumeSession("agent-...", {
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
    github: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    },
  },
});
```

MCP jest hostowane przez proces SDK. W szczególności stdio MCP widzi filesystem hosta SDK, a nie automatycznie filesystem managed Cloud sandboxa.

## Permissions i approvals

Agent SDK pozwala określić m.in.:

```ts
await using session = client.resumeSession("agent-...", {
  cwd: "/workspace/project",
  permissionMode: "standard",
  allowedTools: ["Read", "Grep", "Glob"],
  canUseTool: async (request) => {
    // Kontroler aplikacji może zatwierdzić lub odrzucić wywołanie.
  },
});
```

Obsługiwane permission modes obejmują `standard`, `acceptEdits`, `unrestricted` i `strict`. Sesja może także odzyskać approval, który oczekiwał w momencie utraty połączenia.

## Kolejki, przerwanie i reconnect

Agent SDK jest przygotowane do długotrwałej pracy:

- `send()` może dodać wiadomość do kolejki, gdy poprzednia tura nadal trwa;
- `stream()` emituje `queue_update`;
- `abort()` prosi o anulowanie aktywnej tury bez zamykania sesji;
- `bootstrapState()` pobiera w jednym kroku historię, model, tools i stan approvals;
- `recoverPendingApprovals()` odtwarza oczekującą decyzję po reconnect;
- po wygaśnięciu managed sandboxa należy zamknąć starą sesję i wznowić tę samą conversation, aby otrzymać nowy runtime.

Po błędzie transportu występującym już po udanym `send()` nie należy automatycznie powtarzać wiadomości bez sprawdzenia historii. Oryginalny input mógł dotrzeć do runtime mimo utraty obserwacji przez klienta.

## Czy istniejących agentów trzeba migrować?

Nie tylko dlatego, że aplikacja zaczyna używać Agent SDK.

Agent nie jest „stworzony na SDK”. SDK jest interfejsem, przez który aplikacja uruchamia albo wznawia runtime istniejącego agenta:

```ts
await using session = client.resumeSession("agent-istniejacy-id");
```

Typowe przypadki:

1. **Istniejący `letta_v1_agent` z MemFS** — można użyć jego obecnego `agentId` bez migracji.
2. **Starszy agent oparty na memory blocks bez zainicjalizowanego MemFS** — może wymagać jednorazowej inicjalizacji lub konwersji pamięci, ale niekoniecznie utworzenia nowego agenta.
3. **Bardzo stary typ agenta albo agent zależny od specyficznych server-side custom tools** — wymaga testu kompatybilności; selektywna migracja do nowego agenta może być bezpieczniejsza, ale nie jest ogólnym wymogiem SDK.

Nie należy usuwać blocks ani wykonywać destrukcyjnej migracji przed sprawdzeniem typu agenta, aktywnego MemFS, narzędzi i istniejących rozmów.

## Kiedy użyć którego interfejsu

### Użyj klasycznego REST SDK, gdy:

- budujesz panel administracyjny;
- listujesz, filtrujesz, eksportujesz lub aktualizujesz agentów;
- zarządzasz blocks, archives, tools albo innymi zasobami Cloud;
- potrzebujesz prostego request/response;
- korzystasz z Pythona i nie potrzebujesz pełnego lokalnego harnessu.

### Użyj Agent SDK, gdy:

- agent ma wykonywać pracę na komputerze;
- ma czytać i edytować MemFS;
- potrzebuje shell-a, filesystemu, skills lub subagentów;
- aplikacja musi obsługiwać tool calls i approvals;
- chcesz dołączać client tools lub MCP;
- ten sam kod ma działać z Cloud sandboxem, lokalnie i na VPS-ie.

### Użyj obu, gdy:

- REST API zarządza flotą agentów i ich konfiguracją;
- Agent SDK uruchamia sesje wykonujące właściwe zadania.

## Ważne ograniczenia

- Wysokopoziomowy Agent SDK jest obecnie przeznaczony dla TypeScript/JavaScript.
- Aplikacje Python mogą integrować się bezpośrednio z protokołem WebSocket App Server, ale muszą samodzielnie obsłużyć więcej lifecycle i transportu.
- `cwd` dla Cloud/Remote musi wskazywać ścieżkę wewnątrz wybranego runtime, nie lokalną ścieżkę maszyny klienta.
- Client tools i MCP wykonują się w procesie hostującym SDK, podczas gdy built-in filesystem/shell tools mogą wykonywać się w wybranym sandboxie lub App Serverze.
- Cloud sandbox jest środowiskiem o kontrolowanym TTL, a nie bezterminowo gwarantowaną maszyną.
- Niecommitowanych zmian MemFS nie należy traktować jako zsynchronizowanych z Cloud.

## Dokumentacja źródłowa

- [Letta Agent SDK overview](https://docs.letta.com/agent-sdk/)
- [Agent SDK quickstart](https://docs.letta.com/agent-sdk/quickstart/)
- [Agent SDK reference](https://docs.letta.com/agent-sdk/reference/)
- [Deploying your agents](https://docs.letta.com/agent-sdk/deployment/)
- [MCP and client tools](https://docs.letta.com/agent-sdk/mcp/)
- [App Server protocol lifecycle](https://docs.letta.com/platform/app-server/protocol-lifecycle/)
- [Cloud sandboxes](https://docs.letta.com/platform/computers/cloud-sandboxes/)
- [MemFS](https://docs.letta.com/concepts/memfs/)
- [REST API: Agents](https://docs.letta.com/api/resources/agents)

## Podsumowanie

Najważniejsza zmiana nie polega na nowej składni wywołania agenta. Agent SDK przenosi integrację z poziomu „wyślij wiadomość do zasobu API” na poziom „kontroluj pełną sesję stateful agenta działającego w konkretnym środowisku”.

Dzięki temu aplikacja otrzymuje spójny model dla pamięci MemFS, narzędzi, plików, approvals, kolejek, reconnectu oraz wykonania Cloud/Local/Remote. Klasyczne REST SDK nadal pozostaje wartościowe do zarządzania zasobami Cloud i nie musi zostać usunięte z istniejącej architektury.
