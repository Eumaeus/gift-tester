
You have helped me with a project that is on GitHub at: <https://github.com/Eumaeus/gift-tester>.

Our last conversation was at: <https://x.com/i/grok/share/14f5bb628e6042a5afe4bc99508b74b3>

I'm coming back for help fixing a bug.

Working with a `.gift` in the repository, `gifts/HQ_alphabet_U00.gift`, we see the bug.

This question displays and works fine:

~~~
::Characters 02::
Select the correct Latin-alphabet transliteration of the following Greek character:<br><br><span style="font-size:1.9em;">ὐ</span> {
	=u#Correct.
	~i#That would appear in Greek as 'ι'.
	~hu#That would appear in Greek as 'ὑ'.
	~n#That would appear in Greek as 'ν'.
	~g#That would appear in Greek as 'γ'.
}
~~~

But this one does not show the correct answer among the choices:

~~~
::Characters 01::
Select the correct Latin-alphabet transliteration of the following Greek character:<br><br><span style="font-size:1.9em;">Ο</span> {
	~hi#That would appear in Greek as 'ἱ'.
	~s#That would appear in Greek as 'σ'.
	=o#Correct.
	~ō#That would appear in Greek as 'ω'.
	~ho#That would appear in Greek as 'ὁ'.
}
~~~

Across this quiz, the pattern seems to be that if the correct answer is first, among the distractors, it displays. If it is not first, it is swallowed, *and* the correct-answer-entry appears in the feedback for the distractor that is above it in the list.

Can you take a look and see what is going wrong? Thanks!


---

Conversation at: <https://x.com/i/grok/share/8d146ffade2e4f849d3d2a46823379c8>

Thanks! That fixed it perfectly. This is terrific help, and I am grateful.
