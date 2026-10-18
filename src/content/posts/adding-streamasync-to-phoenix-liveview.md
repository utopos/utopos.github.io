---
title: "Adding stream_async() to Phoenix LiveView"
pubDatetime: 2024-06-06T16:42:15.776Z
canonicalURL: "https://dev.to/utopos/adding-streamasync-to-phoenix-liveview-2kii"
featured: false
draft: false
tags:
  - elixir
  - phoenix
  - liveview
description: "Implement asynchronous assigns for LiveView streams and generate the boilerplate with a stream_async() macro."
---

In this article, you will learn:

- how to implement in LiveView asynchronous assign for `streams`
- how to use the `async_result` function component (UI) for `streams` in Heex templates
- how to use meta programming to auto generate boilerplate for asynchronous stream handling - `stream_async()` macro
- simply add `stream_async` via [Hex package](https://hex.pm/packages/live_stream_async)

## New asynchronous operations in LiveView

A new release of LiveView library — v 0.20.0 — introduced built-in functions for [asynchronous work](https://hexdocs.pm/phoenix_live_view/0.20.14/Phoenix.LiveView.html#module-async-operations). It's a perfect solution to deliver a snappy user experience by delegating some time-consuming tasks (ex. fetching from external services) to background jobs without blocking the UI or event handlers.

- `assign_sync/3` - a straight forward way to load the results asynchronously from these background tasks into socket assigns.
- `start_async/4` - a more granular control over async task result handling.
- `<.async_result` ...> - component to handle the asynchronous operation state on the UI side - Heex templates (for success, loading, and errors).

## Missing companion: `stream_async()`

Sometimes you may need to work asynchronously with [`streams`](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#stream/4).

Streaming results allow working with large collections without keeping them on the server. This functionality is not available out of the box yet.

I will demonstrate further on how to manually implement an asynchronous `stream` assign to the LivewView socket and wrap the whole boilerplate into a reusable `stream_async()` macro.

## Asynchronous streaming in LiveView

In the following example, LiveView loads a list of hotels in a specified location. To load the data, we will use `Hotels.fetch(location)` function. Here's the code:

```elixir
@hotels :hotels

def mount(%{"location" => location}, _, socket) do
  {:ok,
   socket
   |> assign(@hotels, AsyncResult.loading())
   |> start_async(@hotels, fn -> Hotels.fetch!(location) end)
   }
end

def handle_async(@hotels, {:ok, hotels}, socket) do
   {:noreply,
    socket
    |> assign(@hotels, AsyncResult.ok(@hotels))
    |> stream(@hotels, hotels, reset: true)
    }
end

def handle_async(@hotels, {:exit, reason}, socket) do
   {:noreply,
    update(@hotels, fn async_result -> AsyncResult.failed(async_result, {:exit, reason}) end)
    }
end
```

The core of the solution in the presented code revolves around using a pair of assigns:

- `socket.assigns.hotels`: instance of `%AsyncResult{ }` struct handling the async result.
  - (line: `assign(@hotels, AsyncResult.loading())`)
- `socket.assigns.streams.hotels` - `stream` for target large collection
  - (line: `stream(@hotels, hotels, reset: true)`).

I use two different maps in the socket to store necessary data (`assigns` and the nested map: `assignes.streams`). Note I use the same key in both: `:hotels` (the reason will become clear in a moment). Using a combination of a direct assign and a stream assign solves the following challenge: how to store async loading state for a stream that is not yet populated.

According to the documentation, a stream assign must contain only collections and nothing else. We cannot store temporarily any other type of data (here: loading state) as it will produce errors. Thus, need an additional assign to inform whether the stream content is ready to render, or maybe there was an error and stream is not assigned.

It might look tempting to resign from using `%AsyncResult{}` assign and simply stream en empty collection, meanwhile we are fetching "the real data" asynchronously. The role of the empty collection would be to signal "loading state" for the duration of the async operation. **Personally, I don't find this approach right**. An empty stream may indicate to the UI and the user that there's no data returned as a response to their request (in the example: there are no hotels in the indicated location). Furthermore, we would lose the ability to differentiate between "loading state" and "failed state" of collection fetching. As a result, we lose as well the opportunity to provide a meaningful error message to the user.

### Anatomy of the solution

Let's dig deeper into the proposed code:

- `start_async/4` function - [asynchronous task](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#start_async/4) wrapper. Used to get result that will be later streamed.
- `handle_async` - 2x callbacks on the LiveView process to deal with `start_async/4` task results:
  - `{:ok, results}` - success; collection to stream available in `results` variable,
  - `{:exit, reeason}`- failure.
- `Phoenix.LiveView.AsyncResult` - LiveView [struct](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.AsyncResult.html) to track state of an async assign.
  - Set the state and assign results on the struct via functions: ok(), loading() and failed()
  - Read the state by accessing three boolean state fields : `:ok?` (success), `:loading` and `:failed`.
  - Read the results of the async operation be accessing `:result` field.

### Accessing async stream in Heex

When the async collection loading is successful, our socket structure will look like this:

```elixir
%{
  Stream: #Phoenix.LiveView.Socket<
  id: "phx-F9YIUoGp9R8towwB",
  [...]
  assigns: %{
      hotels: %Phoenix.LiveView.AsyncResult{
      ok?: true,
      loading: nil,
      failed: nil,
      result: :hotels
    },
    streams: %{
      hotels: %Phoenix.LiveView.LiveStream{
        name: :hotels,
        [...]
```

Pay attention that use the same atom (`:hotels`) as:

- key to access `socket.assigns` referring to the async state data structure (`%AsyncResult{}`),
- result value of the `AsyncResult.result` field,
- key to access `socket.assigns.streams` where the stream for the large collection eventually ends up.

Although it may look confusing at a first glance, you will see soon that this helps us to produce a highly reusable code in LiveView's` render()` to access the stream:

```html
def render(assigns) do
~H"""
<.async_result :let={stream_key} assign={@hotels}>
  <:loading>Loading hotels...</:loading>
  <:failed :let={_failure}>There was an error loading the hotels. Please try again later.</:failed>
      <ul id="hotels_stream" phx-update="stream">
        <li :for={{id, hotel} <- @streams[stream_key]} id={id}>
          <%= hotel.name %>
        </li>
      </ul>
</.async_result>
"""
end
```

- LiveView built-in `<.async_result ...>` component is designed to work with the `%AsyncResult{}` structs.
- `%AsyncStruct{}` is passed via "`assign={}`" attribute of the component.
- `<.async_result ...>` component @inner_block receives `stream_key` which is used to fetch the correct stream from the `socket.assigns.streams` (accessed by `@streams` in the code). The `stream_key` becomes available in the @inner_block via `:let={}` attribute.

## Use `stream_async()` function

As we could observe, working manually with steams asynchronously adds a repetitive boilerplate to our LiveView. For every collection that we would like to stream, we need to add explicitly `handle_async()` callbacks.

The solution proposed in this article can be easily wrapped in a macro that will auto-generate all the necessary handling callbacks behind the scenes.

The `stream_async/4` macro can be used as follows:

```elixir
  use LiveStreamAsync

  def mount(%{"location" => location}, _, socket) do
    {:ok,
     socket
     |> stream_async(:hotels, fn -> Hotels.fetch!(location) end)
	}
  end
```

The `stream_async/4` macro supports `opts` keyword. Options will be piped accordingly to the `start_async/4` and `stream/3` functions. To learn more about these options, check the official LiveView documentation (in the reference section at the end of the article).

We're rendering results in `Heex` template same as before (repeating):

```html
def render(assigns) do
~H"""
<.async_result :let={stream_key} assign={@hotels}>
  <:loading>Loading hotels...</:loading>
  <:failed :let={_failure}>There was an error loading the hotels. Please try again later.</:failed>
      <ul id="hotels_stream" phx-update="stream">
        <li :for={{id, hotel} <- @streams[stream_key]} id={id}>
          <%= hotel.name %>
        </li>
      </ul>
</.async_result>
"""
end
```

### Macro code

Just add the following macro to your project:

```elixir
defmodule LiveStreamAsync do
  alias LiveView.AsyncResult

  defmacro __using__(_opts) do
    quote do
      import unquote(__MODULE__)
      @before_compile unquote(__MODULE__)
      Module.register_attribute(__MODULE__, :async_streams, accumulate: true)
    end
  end

  defmacro __before_compile__(_env) do
    streams = Module.get_attribute(__CALLER__.module, :async_streams)

    for {stream_id, opts} <- streams do
      quote bind_quoted: [stream: stream_id, opts: opts] do
        def handle_async(stream, {:ok, results}, socket) do
          socket =
            socket
            |> assign(stream, AsyncResult.ok(stream))
            |> stream(stream, results, unquote(opts))

          {:noreply, socket}
        end

        def handle_async(stream, {:exit, reason}, socket) do
          {:noreply,
           update(socket, stream, fn async_result ->
             AsyncResult.failed(async_result, {:exit, reason})
           end)}
        end
      end
    end
  end

  defmacro stream_async(socket, key, func, opts \\ []) do
    Module.put_attribute(__CALLER__.module, :async_streams, {key, opts})

    quote bind_quoted: [socket: socket, key: key, func: func, opts: opts] do
      socket
      |> assign(key, AsyncResult.loading())
      |> start_async(key, func, opts)
    end
  end
end
```

## Hex package `live_stream_async`

For ease, I packaged this macro on [hex.pm](https://hex.pm/packages/live_stream_async), so you can easily add as your project dependency in the `mix.exs`:

```elixir
defp deps do
    [
      {:live_stream_async, "~> 0.1.0", runtime: false}
    ]
```

Use it the same way as described in this article [Use `stream_async()` function](#use-raw-streamasync-endraw-function)

Enjoy!

## Summary

In this article, we learned:

- new functions in LiveView v 0.20.0 to work with asynchronous tasks
- fetching big collection for streaming require using low level `start_async/4` function combined with `handle_async()` callbacks
- combining `%AsyncResult{}` struct with async streaming allows to control the state of loading big collections in the UI
- import `stream_async()` functionality to your project with [hex.pm](https://hex.pm/packages/live_stream_async).

## References

- [Phoenix LiveView Async Operations](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#module-async-operations)
- [Phoenix.LiveView.AsyncResult](https://hexdocs.pm/phoenix_live_view/Phoenix.Component.html#async_result/1)
- [Phoenix LiveView.start_async/4](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#start_async/4)
- [Phoenix.LiveView.stream/4](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#stream/4)
