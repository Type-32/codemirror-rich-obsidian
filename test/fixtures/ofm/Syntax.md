---
title: Syntax
tags:
  - fixture
---
# Links and embeds

Links: [[Plain]], [[Note#Heading]], [[Note#^block]], [[Note|Alias]], [[Note#Heading|Alias]], [[#Local heading]].
Embeds: ![[Picture.png]], ![[Picture.png|300]], ![[Base.base#View]], and an image ![alt](https://example.com/a.png).
Not links: [single], [[]], `[[in code]]`.

# Inline

==Highlight with **bold** inside== and ==two== highlights.
Tags: #tag, #nested/tag, #with-dash, #under_score, #123 is not one, C# is not one, #émoji-ünïcode.
Comment %%hidden inline%% between words.

%%
A block comment
across lines with [[Hidden link]] and #hiddentag
%%

Paragraph with a block id ^para-1

# Tasks

- [ ] open
- [x] done
- [X] done upper
- [/] in progress
- [-] cancelled
- [>] forwarded
- [?] question
	- [!] nested important ^task-id
- not a task [/]

1. [ ] ordered task
2. [x] ordered done

# Callouts in lists and quotes

- Item
  > [!tip] Callout in a list item
  > body with ==mark==

> Quote with [[Quoted link]] and #quotedtag

%%one%% [[Between comments]] %%two%%

A paragraph line
%%
[[Hidden in a comment]]
%%
