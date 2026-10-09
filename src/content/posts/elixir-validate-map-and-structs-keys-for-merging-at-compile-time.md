---
title: "Elixir: map casting to structs (with checks at compile time!)"
pubDatetime: 2024-06-10T08:04:28.017Z
featured: false
draft: false
tags:
  - elixir
  - metaprogramming
ogImage: "../../assets/images/posts/elixir-validate-map-and-structs-keys-for-merging-at-compile-time-cover.png"
description: "Validate map keys against a struct at compile time with a small macro, instead of discovering typos at runtime after deployment."
---

## Intro

In this article you will learn:

- how to leverage compile-time validation of maps to be merged later with %struct{}, that can save you time and hassle after the deployment
- review popular runtime validation functions
- how to use a macro to do the same **at compile time (!)**
- import KeyValidator library to your project from HEX: https://hex.pm/packages/key_validator

## Runtime validations

Elixir and Ecto has built-in functions that perform the key validity check of maps, but only at runtime:

- `Kernel.struct/2`
- `Kernel.struct!/2`
- `Ecto.Query.select_merge/3`

### Kernel.struct!/2

Let's take a look at the following example:

```elixir
defmodule User do
defstruct name: "john"
end

# Following line is a runtime only check:

Kernel.struct!(User, %{name: "Jakub"})
#=> %User{name: "Jakub"}

# Runtime error on key typo:

Kernel.struct!(User, %{nam__e: "Jakub"})
#=> ** (KeyError) key :nam__e not found
```

The expression `Kernel.struct!(User, %{name: "Jakub"})` uses a map literal (`%{name: "Jakub"}`). The User struct definition is known beforehand, as well as the map structure. However, the comparison between the keys in the `User` struct and the map literal will only take place during when the app is running and the code getting actually executed. Thus, any potential typo in the key will be discovered only at runtime.

### Ecto.Query.API.select_merge/3

A similar situation takes place when using a popular `Ecto.Query.select_merge/3` for populating `virtual fields` in schemas:

```elixir
defmodule Post do
	use Ecto.Schema
	schema "posts" do
	  field :author_firstname, :string
	  field :author_lastname, :string
	  field :author, :string, virtual_field: true
	end
end

defmodule Posts do
	import KeyValidator

	def list_posts do
	  Post
	  |> select_merge([p], %{author: p.author_firstname <> " " <> p.author_lastname})
	  |> Repo.all()
	end
end

Posts.list_posts()

```

In the provided example, `Post` schema contains a `:author` virtual field. We want to store a concatenated value of the post's author first name and the last name populated in the query. The `select_merge` will merge the given expression with query results.

If the result of the query is a struct (in our case `Post`) and in we are merging a map (in our case `%{author: data}` literal), we need to assert that all the keys from the map exist in the struct. To achieve this, Ecto uses [`Ecto.Query.API.merge/2`](https://hexdocs.pm/ecto/Ecto.Query.API.html#merge/2) underneath:

> If the map on the left side is a struct, Ecto will check all the fields on the right previously exist on the left before merging.

This, however, is done in **runtime only** again. You will learn whether the map keys conform to the struct key when the particular line of code got executed.

## Compile-time validation

In certain situations, the conformity between map/keyword keys could be already checked at the compile-time.

One example when we can potentially leverage the compile-time validations is when we work with map/keyword **literals** in our code. These literals are provided directly in the Elixir's AST structure during compilation process. We can build on this fact if our **intention is to use the map for casting onto structs at some point in our code**.

We deal with map or keyword literals when the structure is given **inline**:

```elixir
# Map literal:

%{name: "Jakub", lastname: "Lambrych"}

# Keyword literal

[name: "Jakub", lastname: "Lambrych"]
```

In contrast, the following expressions do not allow us to work with literals when invoking merging maps with struct:

```elixir

# map is assigned to a variable
m = %{name: "Artur"}

# Function invoked with variable "m" and not a "map literal".
# No opportunity for compile check.
Kernel.struct(User, m)
```

## Use `KeyValidator` macro for compile-time checks

In the following example, `User` module together with the map literal is defined at the compile time. We will leverage the power of compile-time macros whenever our intention is to use a particular map/keyword literal to be merged at some point with a struct.

To support this, I developed a small `KeyValidator.for_struct/2` macro (available on [Hex](https://hex.pm/packages/key_validator)). Let's see how we can use it:

```elixir
defmodule User do
defstruct name: "john"
end

import KeyValidator

# Succesfull validation. Returns the map:

user_map = for_struct(User, %{name: "Jakub"})
#=> %{name: "Jakub"}

Kernel.struct!(User, user_map)
#=> %User{name: "Jakub"}

# Compile time error on "nam__e:" key typo:

user_map2 = for_struct(User, %{nam__e: "Jakub"})
#=>** (KeyError) Key :name_e not found in User
```

The `KeyValidator.for_struct/2` can be also used with `Ecto.Query.select_merge/3` to populate `virtual_fields`:

```elixir
defmodule Posts do
	import KeyValidator

	def list_posts do
		Post
		|> select_merge([p], for_struct(Post, %{authorrr: "Typo"}))
		|> Repo.all()
	  end
end


Posts.list_posts()
#=> ** (KeyError) Key :authorrr not found in Post
```

The above code will raise a `Key Error` during compilation.

## Install `KeyValidator` from Hex

For convenience, I wrapped the macro in library. It is available on hex with documentation:

https://hex.pm/packages/key_validator

You can add it as a dependency to your project:

```elixir
def deps do
  [
    {:key_validator, "~> 0.1.0", runtime: false}
  ]
end
```

## Source code

Macro code together with `ExUnit` tests can be accessed at the GitHub repo:

https://github.com/utopos/key_validator

## Summary

Using metaprogramming in Elixir (macros) give you an opportunity to analyze the Elixir's AST and perform some checks of structs, maps and keywords before deploying your code.

Adding `KeyValidator.for_struct/2` macro to your project, allows some category of key conformity errors to be caught at an early stage in the development workflow. No need to wait until the code to crashes at runtime. It can be expensive and time-consuming to fix bugs caused by simple typos - i.e. when map keys are misspelled.

Although the macro usage covers some scenarios, we need to bear in mind that it is not a silver bullet. The `KeyValidator` cannot accept dynamic variables due to the nature of Elixir macros. Only map/keyword literals are accepted as their content can be accessed during AST expansion phase of Elixir compilation process.
