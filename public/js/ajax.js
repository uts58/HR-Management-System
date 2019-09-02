$(document).ready(function(){



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
