$(document).ready(function(){

    // Send the page's CSRF token with every jQuery AJAX request.
    $.ajaxSetup({
        headers: { 'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content') }
    });

    authentication = function(){
        //alert(1);

        $.post("/actAdmin",
            {
                username: $("#txtUsername").val(),
                password: $("#txtPassword").val()
            }).done(function( data ) {
                if(data){

                    window.location = '/home';
                }
                else {
                    alert("Invalid User!");
                    txtPassword.value='';
                    txtUsername.focus();
                }
            }).fail(function(xhr) {
                if (xhr.status === 429) {
                    alert("Too many login attempts. Please wait a few minutes and try again.");
                } else if (xhr.status === 403) {
                    alert("Your session expired. The page will reload; please try again.");
                    window.location.reload();
                } else {
                    alert("Login failed. Please try again.");
                }
            });
    };

    authentication_pass=function(){
        $.post("/actChangePass",{
            oldPass: $("#txtoldPass").val(),
            newPass: $("#txtnewPass").val()
        }).done(function(data){
                if(data){
                    alert('Your Password is changed Successfully! \n Please use New Password to Login from the next time');
                    window.location='/home';
                }
                else{
                    alert('Your old Password donot Match! \n Please try again');
                    txtoldPass.value='';
                    txtnewPass.value='';
                    txtrePass.value='';
                    txtoldPass.focus();
                }
            });
    }

})
