function verify()
{
    if(userlogin.txtUsername.value=="")
    {
        alert("Please enter the Username");
        userlogin.txtUsername.focus();
        return false;

    }
    else if(userlogin.txtPassword.value=="")
    {
        alert("Please enter the Password");
        userlogin.txtPassword.focus();
        return false;
    }

    return true;
}

function isNumber(evt) {
    evt = (evt) ? evt : window.event;
    var charCode = (evt.which) ? evt.which : evt.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
        return false;
    }
    return true;
}

function verify_pass()
{
    if(changepass.txtoldPass.value=="")
    {
        alert("Please enter the Old Password");
        changepass.txtoldPass.focus();
        return false;
    }
    else if(changepass.txtnewPass.value=="")
    {
        alert("Please enter the New Password");
        changepass.txtnewPass.focus();
        return false;
    }
    else if(changepass.txtrePass.value=="")
    {
        alert("Please Re-enter the New Password");
        changepass.txtrePass.focus();
        return false;
    }
    else if(changepass.txtnewPass.value != changepass.txtrePass.value)
    {
        alert("The New Password you enter doesnot Match!");
        changepass.txtrePass.value='';
        changepass.txtrePass.focus();
        return false;
    }
    return true;
}

function searchKeyPress(e)
{
    // look for window.event in case event isn't passed in
    if (typeof e == 'undefined' && window.event) { e = window.event; }
    if (e.keyCode == 13)
    {
        document.getElementById('btnSubmit').click();
    }
}




function altRows(id){
    if(document.getElementsByTagName){

        var table = document.getElementById(id);
        var rows = table.getElementsByTagName("tr");

        for(i = 0; i < rows.length; i++){
            if(i % 2 == 0){
                rows[i].className = "evenrowcolor";
            }else{
                rows[i].className = "oddrowcolor";
            }
        }
    }

}

window.onload=function (){
    altRows('alternatecolor');
}

function verify_addemp()
{
    var email = addemp.txtEmail.value;
    var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if(addemp.txtFirst.value=="")
    {
        alert("Please enter the First Name");
        addemp.txtFirst.focus();
        return false;
    }
    else if(addemp.txtLast.value==''){
        alert('Please enter the Last Name');
        addemp.txtLast.focus();
        return false;
    }
    else if(addemp.department.value=='0'){
        alert('Please select the Department');
        addemp.department.focus();
        return false;
    }
    else if(addemp.position.value=='0'){
        alert('Please select the Position');
        addemp.position.focus();
        return false;
    }
    else if(addemp.position.value=='0'){
        alert('Please select the Position');
        addemp.position.focus();
        return false;
    }
    else if(addemp.txtHomeTown.value==''){
        alert('Please enter the Home Town');
        addemp.txtHomeTown.focus();
        return false;
    }
    else if(addemp.txtContact.value==''){
        alert('Please enter the Contact No.');
        addemp.txtContact.focus();
        return false;
    }
    else if(addemp.txtEmail.value==''){
        alert('Please enter the Email');
        addemp.txtEmail.focus();
        return false;
    }
    else if(!filter.test(email)) {
        alert('Please provide a valid email address');
        addemp.email.focus();
        return false;
    }
    else if(addemp.maritalStatus.value=='0'){
        alert('Please select the Marital Status');
        addemp.maritalStatus.focus();
        return false;
    }
    else if(addemp.date.value==''){
        alert('Please select the Date of Birth');
        addemp.date.focus();
        return false;
    }
    else if(addemp.inpFile.value==''){
        alert('Please select the Photograph');
        addemp.inpFile.focus();
        return false;
    }
    return true;
}

function verify_addDep()
{
    if(addDep.txtDepartment.value=="")
    {
        alert("Please enter the Department Name");
        addDep.txtDepartment.focus();
        return false;
    }
    return true;
}

function verify_addPos()
{
    if(addPos.txtPosition.value=="")
    {
        alert("Please enter the Department Name");
        addPos.txtPosition.focus();
        return false;
    }
    return true;
}

function verify_addPer()
{
    if(addPer.department.value=="0")
    {
        alert("Please select the Department Name");
        addPer.department.focus();
        return false;
    }
    else if(addPer.employee_test.value=='0'){
        alert("Please select the Name of Employee");
        addPer.employee_test.focus();
        return false;
    }
    else if(addPer.project.value==''){
        alert("Please enter Project Name");
        addPer.project.focus();
        return false;
    }
    else if(addPer.project_begin.value=='Select Date'){
        alert("Please enter the date");
        addPer.project_begin.focus();
        return false;
    }
    else if(addPer.project_end.value=='Select Date'){
        alert("Please enter the date");
        addPer.project_end.focus();
        return false;
    }
    else if(addPer.rating.value=='0'){
        alert("Please select the Rating");
        addPer.rating.focus();
        return false;
    }
    return true;
}

function verify_addNotice()
{
    if(addNotice.txtnoticeTitle.value=="")
    {
        alert("Please enter the Notice Title");
        addNotice.txtnoticeTitle.focus();
        return false;
    }
    else if(addNotice.txtnoticeType.value=="")
    {
        alert("Please select the Notice Type");
        addNotice.txtnoticeType.focus();
        return false;
    }
    else if(addNotice.txtNotice.value=="")
    {
        alert("Please Enter the Notice");
        addNotice.txtNotice.focus();
        return false;
    }
    return true;
}

function verify_message()
{
    if(message.txtmsg.value=="")
    {
        alert("Please type the message");
        message.txtmsg.focus();
        return false;
    }
    return true;
}

function verify_addLeave()
{
    if(addLeave.leaveType.value=="")
    {
        alert("Please select the Leave type");
        addLeave.leaveType.focus();
        return false;
    }
    else if(addLeave.startDate.value=="Select date"){
        alert("Please select the Date");
        addLeave.startDate.focus();
        return false;
    }
    else if(addLeave.endDate.value=="Select date"){
        alert("Please select the Date");
        addLeave.endDate.focus();
        return false;
    }
    else if(addLeave.descript.value==""){
        alert("Please type the description");
        addLeave.descript.focus();
        return false;
    }
    return true;
}


$(function(){

$(".topnav").accordion({
    accordion:false,
    speed: 500,
    closedSign: '',
    openedSign: ''
    });

})
