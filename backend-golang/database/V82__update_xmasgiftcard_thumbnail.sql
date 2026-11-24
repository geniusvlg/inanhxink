-- Replace the temporary copied logo with the original Xmas Gift Card thumbnail.

UPDATE templates
SET image_url = '/templates/xmasgiftcard/thumbnail.svg'
WHERE template_type = 'xmasgiftcard';
