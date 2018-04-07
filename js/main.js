$(document).ready(function () {
    console.log("Started!...");
    var contactText = $('#contact_text');

    $('.a_contact').mouseenter(function () {
        contactText.html('<h2>' + this.id + '</h2>');
    });

    $('.a_contact').mouseleave(function () {
        contactText.html('<h2>Contacts</h2>');
    });
});