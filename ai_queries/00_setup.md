
You have been helping me with code to generate drills for my Ancient Greek students, in the form of `.gift` files to be uploaded to Moodle. That project is here <https://github.com/Eumaeus/Donafer>.

It is laborious to get those into Moodle… many steps, much clicking. It is equally laborous to remove `.gift` data if I find a bug or want to change something.

So I would like your help on a new project: "Gift-Tester". 

I would like a Javascript/HTML/CSS app that will let me preview `.gift` quizzes quickly and easily.

Some specs:

- There will be a folder in its directory called "gifts". The HTML page will offer a popup menu offering any `.gift` files in that directory.
- There will also be a "Load GIFT" button that will let me pick a file from the file-browser.
- It would be nice to have a page-function and UI, so I can see 5, 10, or 20 items at a time, or all of them at once, and some quick way to page through the questions.
- Once loaded, the quiz will operated as expected.
- Each question should have a "check" button immediately present, which will confirm whether the chosen or entered answer is correct, and offer any feedback the `.gift` file has.
- The questions should behave as they do in Moodle with "Adaptive Mode (no penalties)" selected.
- There should be a running tally of questions answered, correct answers, and incorrect answers.
- Since this is for testing and editing, it would be great to have a "reload quiz" button that will reload the same file, with all the same settings, taking me right back to where I was before hitting "reload quiz".
- An extra feature that might be fun is a "shuffle and export" function, that will export a new `.gift` with the same questions, but with the questions randomly shuffled, and (for multiple choice quizzes) the answers and distractors shuffled.

I only deal in two kinds of quiz at the moment: multiple choice, and fill-in-the-blank (short answer).

Below are two a representative examples of my multiple choice quiz questions:

~~~
::Q002::[markdown]nom. pl. of the noun “human being”:{
	~%100%ἄνθρωποι#Correct: **ἄνθρωποι** is the correct form for nom. pl. of the noun “human being” (Chapter 1).
	~%-100%ἀνθρώπου#Incorrect. **ἀνθρώπου** is the gen. sing. of the noun “human being” (Ch. 1).
	~%-100%ἀνθρώπους#Incorrect. **ἀνθρώπους** is the acc. pl. of the noun “human being” (Ch. 1).
	~%-100%ἀνθρώπων#Incorrect. **ἀνθρώπων** is the gen. pl. of the noun “human being” (Ch. 1).
}

::Q011::[markdown]εἰς + acc:{
	~%50%into#Correct: **εἰς + acc** → “into” (Chapter 1).
	~%-100%concerning#Incorrect. **περί + gen** means “concerning” (Chapter 3).
	~%50%to#Correct: **εἰς + acc** → “to” (Chapter 1).
	~%-100%on behalf of#Incorrect. **ὑπέρ + gen** means “on behalf of” (Chapter 9).
	~%-100%before#Incorrect. **πρό + gen** means “before” (Chapter 2).
}
~~~

Here is a representative sample of a short-answer fill-in-the-blank question:

~~~
::Q13::[markdown]Which god, according to the "great harper" "ordained hard journeys… for the Greeks on their way back from Troy?" {=Pallas Athena =Athena}
~~~

You can see that in this one, I allow two different correct answers.

I like to keep HTML, JS, and CSS code in separate files.

I have started a GitHub repository for this work: <https://github.com/Eumaeus/gift-tester>.

Is this a project you can help me with?



In it is a directory `ai_queries` where I will keep a record of our conversation.
