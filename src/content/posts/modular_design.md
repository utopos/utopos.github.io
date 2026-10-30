---
title: "Dealing with complexity using Modular Design"
alternative_titles: "Modular Design in Elixir"
pubDatetime: 2026-10-17
featured: false
draft: false
tags:
  - elixir
  - ash
description: "" #todo
ogImage: "../../assets/images/posts/modular_design/cover.png"
---



I am working on with a client is a typical Phoenix + Postgres repo. The app has been pretty succefull comercially and it resulted in over 8 years repo with nudreads of modules and relatiosnips. Just a few stats:

<!-- list of stats from claude -->
- 2581 modules
- 29,565 functions
- 276 tables
- Most connected schema: 130 references from other schemas
- 100 fields in few tables 
<!-- illustration of interconnections -->

The Miller's Law that the average human short-term memory can hold roughly 5 to 9 discrete items at one time <!-- todo: reference --> . In this perspective working with such repo is cognitively demanding, if not impossible by a human. 

In the advent of the new AI the work get easier at the first glance. The AI tools like claude code are way better at finding the edge cases and navigating the tigh coupling between the modules. Even though the implementation is sped up, it still give hic ups. The worst is that the boost privded by the tool in both analysis and development does not reduce the cognitve load of team. The accountability of a a human software developer and a human reviewer does not change. It is human in the end that takes the respobility for both the feature delivery and the delivery sign of. And you need have a solid grasp of all the changes made and its consequences. A better decomposition with lower coupling would benefit both: humans and AI tools.

## Complexity

- > "Complexity is like a waterbed. Push it down in one place, and it bulges up somewhere else." by Larry Wall

Complexity is an inherent characteristics of big systems. Can it be reduced? Complexity  grows over time as the system grows. We can of course change the code orgnization, apply certain architectural patterns. We dont necessarily simplify things. We may just distribute complexity differnlty.

<!-- chart: complexity over time -->


Although the complexity cannt be reduced it can be managed differently though dpyjsy we have in midn also different software quality charactersitics [^iso25010]:  

- maintainability, 
- analysability, 
- modifiability, 
- modularity, 
- reusability 
- and testability .  

**The question we should be asking ourselves therefore should be different. How to decompose the domain model in order to keep an eye on the following quality characteristics.**?


## Problem: decomposition by nouns

The problem is comes from the domain modelling techniques focused on the nouns (for more check out my aritcles on Domain Driven Deisgn <!-- todo: link to the blog on DDD --> ). 

Decomposition style: a natural decomoposition start with nouns. We analyze the domain (DDD) we build the data model. This way leads us towards up with a global monolithic data model represeting nouns [^ddd kuba]. Then comes the behaviour part that responds to the functional requirements that spans over the whole data model. Sounds familiar? The problem is we edn up operating on a single big global problem that quickly becomes hard to follow. We have to think about bith aspects: data representation and the behaviour that uses this representation (association, current definition




## Example
Lets take a look at an example.

Here is the domain problem from my side project `haps.today`: a platform for curation and distribution of your neighbourhood events to the subscibers to Whatsapp.

Lets stary with the following:
- Event is published to a platform by a curator.

Here are some screenshot:

<!-- insert a screenshot from haps.todo -->

We start with the nouns. A single `Event` entity, its data and the rules that guard it. On the left the schema, on the right the interface (the surface other modules depend on):

<div class="code-pair">

```elixir file="Schema"
Event
  title: string               
  description: string         
  start: datetime             
  duration_minutes: integer   
  cancelled: boolean
  
  belongs_to: Author           
```

```elixir file="Interface"
fetch_by_id(id)
publish(event)
cancel(event)
search(query)
find_by_author_id(author_id)
find_by_date(date)
```

</div>

### New feature - Slugs

Perfect. Now I want to add a feature where we add slugs for the web. For example: `/events/2026/10/26/elixir-meetup`. The schema and the interface now look like this:

<div class="code-pair">

```elixir file="Schema"
Event
  title: string
  description: string
  start: datetime
  duration_minutes: integer
  cancelled: boolean
  slug: string # [!code ++]

  belongs_to: Author
```

```elixir file="Interface"
fetch_by_id(id)
publish(event) # [!code highlight]
cancel(event)
search(query)
find_by_author_id(author_id)
find_by_date(date)
find_by_slug(slug) # [!code ++]
```

</div>

It was a very small change. We added addition field (`slug`) and a new function (`find_by_slug(slug)`). However this new feature required us to also modify an existing `publish(event)` context functions since it also now responsible for creating a slug for the event.

### New feature: Review events

Now comes a new requirement. Oour goal is to provide a human verification step before an event can get published.

Out worflow will look the following: Submit Event -> Review -> Publish

Here is how our schema and interface will change:

<div class="code-pair">

```elixir file="Schema"
Event

title: string
description: string
start: datetime
duration_minutes: integer
cancelled: boolean
slug: string
status: Ecto.Enum, # [!code ++]
[:submitted, :rejected, :published] # [!code ++]
reject-reason: string # [!code ++]
belongs_to: Reviewer # [!code ++]
belongs_to: Author
```

```elixir file="Interface"
EventContext

fetch_by_id(id)
publish(event) # [!code highlight]
cancel(event)
search(query, state) # [!code highlight]
find_by_author_id(author_id, state) # [!code highlight]
find_by_date(date, state) # [!code highlight]
find_by_slug(slug, state)  # [!code highlight]
submit(event) # [!code ++]
reject(event) # [!code ++]
```

</div>

Let's go through what has changed:

- **New field `status`**: the event now has a lifecycle (`:submitted`, `:rejected`, `:published`) instead of being published straight away.
- **New association `Reviewer`**: someone other than the author now has to approve the event, so `Event` holds a second relationship.
- **New functions `submit(event)` and `reject(event)`**: the author no longer publishes. They submit, and the reviewer either rejects or publishes.
- **Modified `publish(event)`**: it used to be the author creating an event (and, since the slugs feature, generating the slug). Now it's a reviewer action that only works on a `:submitted` event. Its meaning changed, so every caller has to be checked.
- **Modified `search`, `find_by_author_id`, `find_by_date` and `find_by_slug`**: each one now takes a `state` argument. A regular visitor should only see published events, while authors and reviewers need to see submitted or rejected ones too. That changes every function signature, so every caller has to change as well.
- **Unchanged but still checked, `cancel(event)` and `fetch_by_id(id)`**: their code didn't change, but we still had to work out how `cancelled` relates to the new `status` and whether `fetch_by_id` should return an event nobody has published yet.

One feature, two new functions, and **every existing function had to be touched or at least re-checked**.

Adding new feature that touches existing data model can break the existing business logic. the exsiting modules requires reviewing the existing code and changesets. The context interface changes in many places. Tests has to be reviewed. Furthermore more all the places in the system that uses the changes interface has to reviewed and test again. Thus a new feature that touches my project over 100 fields schemas would require almost all system testing to validate nothing was left broken.

This is the basic problem with monolithic data models where everythting si interconnected with everything (a typical phoenix develpoment way):

- few entities organized around nouns
- hich coupling


## Modular Design

I came across the Modular Design approach in a great talk from [Maciej Kaszubowski](https://www.youtube.com/watch?v=hgDCg3QdZgU) from 2019. Its a concept  original paper was published "On the Criteria To Be Used in Decomposing Systems into Modules" [^modular-design]. Author argued that how you divide a system dictates its maintainability, flexibility, and comprehension. Parnas proposed dividing it by difficult design decisions or design decisions likely to change—a concept known as information hiding. 

In this perspective, every module should hide a secret (a data structure, an algorithm, or a hardware dependency) from the rest of the system. The paper established that modules are not merely subroutines or steps in a flowchart; they are responsibility assignments that encapsulate and protect design decisions from change. This approach strongly resonate with SOLID principles: the change is done by extension (open-closed principle) while the module interface stays unchanged.

## Decomposition by Behaviour

This shifts the focus to the expected behaviour first and the domain model supporting the behaviour come second.

The modular decomposition result should be following:

- small modules
- fixed interfaces
- low coupling
- easy to replace

How to model it? Michał in propose steps in the following order:

1. What is the expected outcome?
2. Wht data do I need?
3. Where do I get data?

As a good excercise that focuses on outcome and not underlying datra I propose to use the Event Storming visual excercise for the design team that I describe in article <!-- insert link to the event storming article --> . You can link with DDD where bounded context represent your modules and the data you need represent aggregates.

## Example

Let's revisit our domain of `haps.today` - a social event curaiton platform. Our is domain is following:

- Author can submit and event.
- Reviewer accepts/rejects an event for pubishing
- System sends whatsapp notfiction to the subscribers.

Our requiremens define the expected behaviour of the system. If we map each behaviour to a module, we might get this design:

- Authoring 
- Moderation
- Publishing
- Notifications

### Authoring

We start with with authoring. This module should allow the author to submit and witdra events:

<div class="code-pair">

```elixir file="Schema"
Event
title: string               
description: string         
start: datetime             
duration_minutes: integer
author_id: uuid
```

```elixir file="Interface"
Authoring

submit(event)
withdraw(event)
get_by_id(id)
list_events_by_author(author_id)
```

</div>

### Moderation

```elixir file="Schema"
Review
event_id: uuid
reject_reason: string
```

```elixir file="Interface"
Moderation

accept(event_id)
reject(event_id, reason)
```

### Publishing

```elixir file="Schema"
Event
title: string               
description: string         
start: datetime             
duration_minutes: integer
author_id: uuid
cancelled: boolean
```

```elixir file="Interface"
Publishing

publish(event)
cancel(event)
get_by_id(id)
list_events_by_author(author_id)
```

### Slugs

```elixir file="Schema"
Slug
event_id: uuid
slug: string
```

```elixir file="Interface"
Slugs

slugify(event_id)
get_id_by_slug(slug)
```

## Conlusions

- Eventsotrming can help in modeling the behaviours (focus on outcomes).

# Outline

## Intro

I am working on with a client is a typical Phoenix + Postgres repo. The app has been pretty succefull comercially and it resulted in over 8 years repo with nudreads of modules and relatiosnips. Just a few stats:




IN such complex systems 

- talk if michal kszubowski
- not article about it i dicided to write about
- complexity is an inherent characteristics of systems that grows over time and theres nothing we can do about it. We can change the code orgnization moving the complexity into different layer.

## Complexity

- my current project
- _image illustrating big ball of nouna_
- x modules and x schemas
- x relatiosnhips
- lots of interconnection
- cognitive overlaod 4-7 rule
- THe dillema: need to use AI to digure out byt im in the end responsible.
- one data model with overarching business logic spread among many places.
- Touching existing data model can break some predting business logic.
- > "Complexity is like a waterbed. Push it down in one place, and it bulges up somewhere else." by Larry Wall
- So what can be done? while complexity cannot be reduced, we can think of different way of decomposition of the problem to keep high other characteristics like maintainability, flexibility, and comprehension

## The problem Big ball of nouns

- Decomposition style: a natural decomoposition start with nouns. We analyze the domain (DDD) we build the data model. This way leads us towards up with a global monolithic data model represeting nouns [^ddd kuba]. Then comes the behaviour part that responds to the functional requirements that spans over the whole data model. Sounds familiar? The problem is we edn up operating on a single big global problem that quickly becomes hard to follow. We have to think about bith aspects: data representation and the distributed behaviour that uses this representation (association, current definition).
- New features: When new feature comes in we modify the data model and need to inspect every place if noting is broken (i.e. reports). This costs lots of time and si highly error-prone. Anemic data model where the contexts contain little to no business logic.

## Modular Software deisgn

- quote from the paper
- decomposition based on the behaviour or specific problem but not on nouns.
- focus on a complex functionality we want to hide and not obsess around nouns.
- SOLID: new feature is a new module that represent its behaviour.
- In DDD term we end up with different domain that can have the same nouns that mean sth different in different contexts.
- _image represning modular deisgn with behaviours_
- summary;
  - comprehension: small modules that do one job only. Keep the 4-7 rule
  - mainteinablity: strong boundaries + low coupling
  - flexibility: modules can be easly removed and exchanged
- Elixir and functional programming in naturally decouples well the data from behaviour [^jose-valim], making the latter the first class citizen. In Modular design we focus on defining the interface **while keeping the data model local and hidden**.

## Example of the problem

- **Example** how stacking arounf the noun works
- Haps.today <!-- link to the website -->
- facilittes curation and distribution of local events to the subscibers to Whatsapp.
- Event is added to a pltform by a curator. It then reviewed by a Local Guide. After its accepted it is published for wider audience.

### Event (initial)

Schema:

```elixir
title: string
cover_image_url: string
description: string
start: utc_datetime
duration: minutes
belongs_to: author
cancelled: boolean
```

Interface:

```elixir
fetch_by_id
publish
cancel
search
find_by_author_id
find_by_date
```

### New feature - Slugs

Legend: green `+` = new, red `-` = removed, amber `~` = existing function whose internals must change.

Schema:

```elixir
title: string
cover_image_url: string
description: string
start: utc_datetime
duration: minutes
belongs_to: author
cancelled: boolean
slug: string # [!code ++]
``` 

Interface:

```elixir
fetch_by_id
publish
cancel
search
find_by_author_id
find_by_date
find_by_slug # [!code ++]
```

- need to add another function

### New feature - Reviews

Require a community review before the event is displayed to other users.

Submit -> Review -> Publish

Schema:

```elixir
title: string
cover_image_url: string
description: string
start: utc_datetime
duration: minutes
belongs_to: author
cancelled: boolean
slug: string
status: Ecto.Enum, values: [:submitted, :rejected, :published] # [!code ++]
reviewed_at: utc_datetime # [!code ++]
rejection_reason: string # [!code ++]
belongs_to: reviewer # [!code ++]
```

Interface:

```elixir
fetch_by_id # [!code highlight]
publish # [!code highlight]
cancel # [!code highlight]
search # [!code highlight]
find_by_author_id # [!code highlight]
find_by_date # [!code highlight]
find_by_slug # [!code highlight]
submit # [!code ++]
reject # [!code ++]
```

So now have to modify the functions because after adding a review step we need to check if all other funcition correctly and change the some of the functions:

- `publish` is now a reviewer action (`submitted -> published`); creation goes through `submit`
- `cancel` keeps setting the `cancelled` flag; it is independent of `status`
- `search`, `find_by_*` and `fetch_by_id` must exclude non-published events for regular users

## Conslusion

You can see how a small change to the data model requires lots of checks and changes in all the places where the module is used.

The open-closed principle of SOLID programming is vaioletaed here since the extension is done though modification of existing modules Not by extension. However from I saw in most of the repos: this is the decomposition path taken in development Phonix projects,

The problem however is even biggerIt's enough that tthere more model that use our Events table - Metrics context that displays event per author though loads the events though a count on a joinm or number of all the published posts or BookingContext that loada   (i have a table with 138 refences) . CHanging anything in the only requires not only changing the EventContext but checking alsmost the whole system.  The problem is tight coupling of the modules. It's becasue  they are coupled on the data model and not behaviour (interface) 

<!-- image related contexts and tables -->

## Others

- Pros
- Cons
- Summary

# Sketchbook

- complexity
- example of my current projects
  - adding a new feature with some schema fileds can break reports in a remote part of the system
  - we change the data model and now we need to change the behaviour
  - data model is big and complicated and thus the behaviour is also spread out
  - this is a ery common wat of working.
  - why? becasue the system is decomposed based on many nouns
- the complexity grows over time
- brutal truth: 4-7 things

- Intro
  - complexity and size increase over time it is something we cannot avoid just del with it.
  - problem: in complex system modules and schemas are interconnected and understanding them hits the possible cognitive load. Accordinf to science we can handle at most of 4-7 things in our memory.
  - in the advent of the AI its way easier troack complex dependencies but you get a feeling of AI takinv over you understadnding and you have no onter choice than accept tha AI understadning. Human still is accountable but cannot understsdn the complexity.
- Modular Design
  - is an old concept dating back to 1972. It's all about criteria of the system decomoposition that doesnt get old.
  - SOLID principles apply here as well
  - anemic data model
  - Charactersitcs
    - low coupling
    - strong boundaries
    - small modules
  - Chacteristics
    - understood, modified, test in isolation
    - replaced or removed
- Example
  - Posts + Slugs + Review + Publish + Digest send
  - open closed principle - we need change functions when we add, addition tests or conditionals
  - every feature make the schema and context bigger
  - changing anything in the Post table requires going though every part of the system to check whether nothing was broken
  - Summary
    - few nouns / entites
    - many interaction between entities
    - logic organised arounf nouns
    - action are mainly updates
    - a lot of coupling as a result
  - Differnt modelling approach
    - sinilar to DDD. Meaning of the Noun depends on the context. That is why in DDD we may have same nouns bu representing sth elese in a differen bounded context.
    - Focus on the responsability / behaviour / outcome of the module
      - then i think what data i need
      - how should get data
      - design UI
- Example - Adding slugs
  - Converting slugs to ids and vice versa
- Job Publishing and JobPosgt enforcing structure of the parameters on the boundary (btw. this is grest and done by ahs automatically)

- well defined interface
- Pros
- Cons

"On the Criteria To Be Used in Decomposing Systems into Modules" (1972) by David L. Parnas, a foundational paper in software engineering and the origin of the concepts of information hiding and modern modularity. Parnas argued that how you divide a system dictates its maintainability, flexibility, and comprehension.
Instead of splitting a program by processing steps, Parnas proposed dividing it by difficult design decisions or design decisions likely to change—a concept known as information hiding. Every module should hide a secret (a data structure, an algorithm, or a hardware dependency) from the rest of the system. the paper established that modules are not merely subroutines or steps in a flowchart; they are responsibility assignments that encapsulate and protect design decisions from change. [^jose-valim]



 
# References


[^iso25010]: [ISO/IEC 25010:2023 - Systems and software engineering - Systems and software Quality Requirements and Evaluation (SQuaRE) - Product quality model](https://www.iso.org/standard/78176.html)

[^jose-valim]: [Keynote: Gang of None? Design Patterns in Elixir - José Valim | ElixirConf EU 2024](https://www.youtube.com/watch?v=agkXUp0hCW8)

[^modular-design]: [On the Criteria To Be Used in Decomposing Systems into Modules" (1972) by David L. Parnas](https://dl.acm.org/doi/10.1145/361598.361623)
