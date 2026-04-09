# AG-2 - Test Story

## Summary
- This story describes an admin logging in, adding a department, adding a Gatekeeper-type user, saving the changes, and logging out.
- The test cases below are derived only from the Jira story content and safe QA inference, without using live application validation.

## Assumptions
- The application supports admin login.
- The application contains a Departments area where a department can be added.
- The application contains a Users area where a Gatekeeper-type user can be added.
- Saving is required to persist both the new department and the new user.
- Logout is available to the admin user after completing the workflow.

## Test Cases

### TC-01: Admin completes the full story successfully
Priority: High
Type: Positive

Given the admin user has valid credentials
And the admin has permission to manage departments and users
When the admin logs in
And navigates to Departments
And adds a new department with valid required details
And navigates to Users
And adds a new Gatekeeper-type user with valid required details
And saves the changes
And logs out
Then the department should be created successfully
And the Gatekeeper-type user should be created successfully
And the admin should be logged out successfully

### TC-02: Admin login fails with invalid credentials
Priority: High
Type: Negative

Given the user is on the login page
When the user enters an invalid admin username or password
And attempts to log in
Then the login should be rejected
And the user should remain on the login page
And an appropriate authentication error should be shown

### TC-03: Department creation requires mandatory fields
Priority: High
Type: Validation

Given the admin is logged in successfully
And the admin navigates to Departments
When the admin starts adding a new department
And leaves one or more mandatory fields blank
And tries to save
Then the department should not be created
And validation messages should be shown for the missing mandatory fields

### TC-04: Department can be added with valid mandatory data only
Priority: High
Type: Positive

Given the admin is logged in successfully
And the admin navigates to Departments
When the admin adds a new department with all mandatory details
And saves the department
Then the department should be created successfully
And the new department should be available for downstream user assignment or business use

### TC-05: Duplicate department handling is enforced
Priority: Medium
Type: Negative

Given the admin is logged in successfully
And a department with the same identifying value already exists
When the admin attempts to add another department with duplicate details
And saves the department
Then the system should either block the duplicate entry or handle it according to business rules
And the response should be clear to the user

### TC-06: Gatekeeper user creation requires mandatory fields
Priority: High
Type: Validation

Given the admin is logged in successfully
And the admin navigates to Users
When the admin starts adding a Gatekeeper-type user
And leaves one or more mandatory user fields blank
And tries to save
Then the user should not be created
And validation messages should be shown for the missing mandatory fields

### TC-07: Admin can create a Gatekeeper-type user successfully
Priority: High
Type: Positive

Given the admin is logged in successfully
And the admin navigates to Users
When the admin adds a new user with Gatekeeper-type role and valid required details
And saves the user
Then the user should be created successfully
And the created user should be associated with the Gatekeeper-type role

### TC-08: User creation rejects invalid email format
Priority: Medium
Type: Negative

Given the admin is logged in successfully
And the admin navigates to Users
When the admin enters an invalid email format for the new Gatekeeper-type user
And attempts to save
Then the user should not be created
And an email validation message should be displayed

### TC-09: Duplicate user handling is enforced
Priority: Medium
Type: Negative

Given the admin is logged in successfully
And a user already exists with the same unique identifier such as email
When the admin attempts to create another Gatekeeper-type user with the same unique value
And saves the user
Then the system should reject the duplicate user or handle it according to business rules
And the user should receive a clear validation or error message

### TC-10: Save action persists both created entities in sequence
Priority: High
Type: Workflow

Given the admin has added a new department
And the admin has added a new Gatekeeper-type user
When the admin saves the required data at each step of the workflow
Then the department should remain saved
And the Gatekeeper-type user should remain saved
And the workflow should not lose previously entered successful data

### TC-11: Logout works after completing administrative actions
Priority: High
Type: Navigation

Given the admin is logged in
And the admin has completed department and user creation activities
When the admin chooses to log out
Then the current session should end successfully
And the admin should be redirected to the login page or logged-out state

### TC-12: Unauthorized user cannot perform the same admin story
Priority: Medium
Type: Negative

Given a non-admin or insufficiently privileged user is logged in
When that user attempts to access department creation or Gatekeeper user creation
Then access should be denied or restricted
And the unauthorized user should not be able to complete the story workflow

### TC-13: Partial workflow interruption does not create inconsistent data
Priority: Medium
Type: Edge Case

Given the admin has successfully created a department
And the admin has not yet successfully created the Gatekeeper-type user
When the workflow is interrupted before the user is saved
Then the system should preserve only the successfully completed operations
And it should not create a partially saved invalid user record

### TC-14: Story workflow supports navigation between modules
Priority: Medium
Type: Navigation

Given the admin is logged in successfully
When the admin moves from login to Departments
And then from Departments to Users
Then the navigation should allow the admin to continue the intended business workflow without unnecessary blockers

### TC-15: Gatekeeper user is created with the intended role selection
Priority: Medium
Type: Edge Case

Given the admin is adding a new user
When the admin selects the Gatekeeper-type role
And completes the save action
Then the resulting user should not be assigned a different default role
And the saved role should match the intended Gatekeeper-type selection

## Notes
- These test cases are based only on the Jira story text in `AG-2.json`.
- The story text is brief, so some validations and edge cases are inferred from standard QA coverage practice.
- This output is intended to be user-readable and BDD-style rather than machine-structured JSON.
