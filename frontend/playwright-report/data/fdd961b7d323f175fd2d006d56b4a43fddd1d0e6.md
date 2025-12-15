# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Login to System" [level=4] [ref=e5]
      - paragraph [ref=e6]: Enter your email and password
    - generic [ref=e8]:
      - alert [ref=e9]:
        - img [ref=e10]
        - generic [ref=e12]: Invalid email or password
      - generic [ref=e13]:
        - generic [ref=e14]:
          - generic [ref=e15]: Email or Username
          - textbox "Email or Username" [ref=e16]:
            - /placeholder: Enter your email or username
            - text: test@example.com
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e19]: Password
            - link "Forgot Password?" [ref=e20] [cursor=pointer]:
              - /url: /forgot-password
          - textbox "Password" [ref=e21]:
            - /placeholder: ••••••••
            - text: testpassword123
        - button "Login" [ref=e22]
      - paragraph [ref=e24]:
        - text: Don't have an account?
        - link "Sign up" [ref=e25] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e31] [cursor=pointer]:
    - img [ref=e32]
  - alert [ref=e35]
```