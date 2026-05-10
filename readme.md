# Glotmaxxing

A focused Wiktionary reader for looking up a word across a small ranked set of preferred languages as a PWA hosted at: https://appmogged.com/glotmaxxing/

## About the app

The app is designed for English speakers learning foreign languages. Users will enter the other languages that they are learning when initially setting up the app, then be able to quickly look up definitions, translations, and conjugations. 

Users will enter a word, and the app will check the Wiktionary entries for that word. If the word is English, it will return the translations for each sense of the word. If the word is not English but matches at least one of the preferred languages, the app will return the highest-preference language result, which shows the English definition.

For all words, the app determines the lemma of the query and returns those results as well. For non-English words, it will also provide the conjugation tables in addition to the English defintion/translation. Words that have a presence in both English and at least one preferred language will default to showing the English word result, unless the English definition is minimal. 

## Initial set up

Visit appmogged.com/glotmaxxing/ then install the app. The search bar will appear at the bottom, but will require you to set your langugages first. Clicking the bar will open the right panel, which has instructions on setting languages. Language settings and theme are stored to your device. 

## Technical notes

The app is a focused reader of Wiktionary, pulling live data from Wikimedia, parsing it, and then showing it in a convenient way. It is designed for Romance languages. It has been tested for Spanish, Portuguese, French, Italian, Galician, and Catalan.Other language families may work. Other writing systems likely will not work. 