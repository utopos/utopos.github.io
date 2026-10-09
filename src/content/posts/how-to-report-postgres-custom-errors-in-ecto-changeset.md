---
title: "How to report Postgres custom errors in Ecto Changeset"
pubDatetime: 2022-01-10T13:43:38.000Z
featured: false
draft: false
tags:
  - elixir
  - ecto
  - postgres
ogImage: "../../assets/images/posts/how-to-report-postgres-custom-errors-in-ecto-changeset-cover.png"
description: "Capture custom Postgres errors as Ecto.Changeset errors instead of raising exceptions — no try/rescue, works out of the box with Phoenix."
---

Sometimes you may find yourself in the need to capture a `Postgres` (or any other RDBMS) custom error in the `Ecto.Changeset` without raising an exception. This enables you to handle all the errors in one place without braking your aesthetic Elixir functional code with “try/rescue” constructs.

It has one big advantage: as the `Ecto.Changeset` is a “lingua franca” of many libraries and frameworks (like Phoenix), embedding error reports in the changeset struct will work for you out of the box without any additional error handing burden. Less code, less maintenance!

## Under the hood

Currently, the `Postgres Ecto Adapter` (same as other adapters for major RDBMS) provide only limited support for reporting errors inside the `Ecto Changeset`. Let’s have a glimpse into the Postgres adapter [source code](https://dev.to/utopos/how-to-report-postgres-custom-errors-in-ecto-changeset-54m):

```elixir
@impl true
    def to_constraints(%Postgrex.Error{postgres: %{code: :unique_violation, constraint: constraint}}, _opts),
      do: [unique: constraint]
    def to_constraints(%Postgrex.Error{postgres: %{code: :foreign_key_violation, constraint: constraint}}, _opts),
      do: [foreign_key: constraint]
    def to_constraints(%Postgrex.Error{postgres: %{code: :exclusion_violation, constraint: constraint}}, _opts),
      do: [exclusion: constraint]
    def to_constraints(%Postgrex.Error{postgres: %{code: :check_violation, constraint: constraint}}, _opts),
      do: [check: constraint]
```

We can see that certain Postgres errors, namely those related to constraints, get a special treatment at the adapter level so that later could be transformed into relevant changeset errors on demand (by calling `*_constraint` functions in the changeset). Meanwhile, the remaining errors will be let through and propagated to your code. There are only few constraint error codes that get intercepted:

- :unique_violation
- :foreign_key_violation
- :exclusion_violation
- :check_violation

## Solution

The method I would like to propose is to disguise your custom database error as one of the constraints that is already implemented by default in the Postgres Ecto adapter (see above).

In this example, I will define and raise a custom error from within a PL/pgSQL trigger function using Postgres’ `check_contraint` ERRCODE, but you can use any of the four, whichever makes more sense to you.

## Step 1. Raise error in Postgres codebase.

```sql
CREATE FUNCTION custom_check() RETURNS TRIGGER AS $$
  BEGIN
    IF <SOME CONDITION> THEN
        RAISE EXCEPTION 'CUSTOM ERROR'
        USING ERRCODE = 'check_violation',
        CONSTRAINT = 'name_of_your_contraint';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
```

where:

- `CUSTOM ERROR` is a custom string lateral of **your choice** that will be passed to Ecto as the error message text.
- `ERRCODE` must be one of the following:
  - `unique_violation`
  - `foreign_key_violation`
  - `exclusion_violation`
  - `check_violation`
- `CONSTRAINT` **must have** a name of your choice that will uniquely identify the custom error in the Ecto Changeset.

> **Please note:** a comprehensive list of Postgres error codes can be found in the Postgres Documentation — Errors and Messages.

## Step 2 Define standard constraint in Ecto Changeset.

In this case, I consistently follow check_contraint error code raised in Postgres and call check_constraint function in the changeset to capture it.

```elixir
def changeset(schema, attrs) do
   schema
   |> check_constraint(:some_field, name: name_of_your_contraint: , message: "custom error message")
end
```

where:

- `:some_field` is a key of associated with the model struct. It is particularly useful when working with Phoenix forms.
- `:name_of_your_contraint` is an atom reflecting the same name as the one defined in the Postgres codebase.
- `message` is an error message on Ecto side that will from additional contextual information.

To make your Elixir code more readable, you could consider some refactoring:

```elixir
def changeset(schema, attrs) do
   schema
   |> my_custom_error(:some_field)
end

defp my_custom_error(schema, key) do
  schema
  |> check_constraint(key, name: name_of_your_contraint: , message: "custom error message")
 end
```

A minor trade off is that a potential error description in the changeset has to be related to a key in the existing Schema struct. This is because changesets are designed on field level. If you use Phoenix form, you can compensate this drawback with an accurate error message propagated to the user.

## Summary

In this article, I tried to propose a fairly easy technique to intercept custom database errors and turn them into a `Ecto Changeset` errors. This all without the need to override your `Repo` module functionality nor forking the adapter’s code, which would be way more difficult to maintain with new `Ecto` library updates.

Please, feel free to leave your comment and share other approaches that you came across.
