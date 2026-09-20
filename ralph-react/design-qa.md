# Player card display design QA

Reference: the existing Player V3 table, the user's large-screen teaching brief,
and the requested North/South suit comparison and card-design choices.

## Visual comparison

- Preserved the established green-felt table, high-contrast status controls,
  compact concealed defenders and unobstructed central trick area.
- Replaced independent top/bottom fans with a shared suit grid. Browser
  measurements at 1280×720 confirmed both strips occupy the same 858 px span,
  with no document overflow.
- Added dark suit rails and a wider near-black hearts/diamonds rail.
- Checked Broadcast clarity, Classic courts and Four-colour teaching in live
  card play at 1650×1050; the remaining two themes use the same tested card
  dimensions and selector path.
- Checked the complete play table at 1280×720. Both visible hands, the central
  trick and controls remain within one viewport.
- Browser console contained no application errors. The only warning was the
  expected Netlify Identity warning for local HTTP development.

Final result: passed
