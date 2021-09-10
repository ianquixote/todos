const express = require("express");
const morgan = require("morgan");
const TodoList = require("./lib/todolist");
const Todo = require("./lib/todo");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const { sortTodoLists, sortTodos } = require('./lib/sort.js');
const store = require("connect-loki");

const app = express();
const host = "localhost";
const port = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({})
}));
app.use(flash());

app.use((req, res, next) => {
  let todoLists = [];
  if ("todoLists" in req.session) {
    req.session.todoLists.forEach(todoList => {
      todoLists.push(TodoList.makeTodoList(todoList));
    });
  }

  req.session.todoLists = todoLists;

  next();
});
//extract session info
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

app.get("/", (req, res) => {
  res.redirect("/lists");
});

app.get("/lists", (req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(req.session.todoLists)
  });
});

app.get("/lists/new", (req, res) => {
  res.render("new-list");
});

app.post("/lists", [
  body("todoListTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("The list title is required.")
    .isLength({ max: 100 })
    .withMessage("List title must be between 1 and 100 characters.")
    .custom((title, { req }) => {
      let duplicate = req.session.todoLists.find(list => list.title === title);
      return duplicate === undefined;
    })
    .withMessage("List title must be unique."),
],
(req, res) => {
  let errors = validationResult(req);
  if (!errors.isEmpty()) {
    errors.array().forEach(message => req.flash("error", message.msg));
    res.render("new-list", {
      flash: req.flash(),
      todoListTitle: req.body.todoListTitle,
    });
  } else {
    req.session.todoLists.push(new TodoList(req.body.todoListTitle));
    req.flash("success", "The todo list has been created.");
    res.redirect("/lists");
  }
});

app.get("/lists/:listId", (req, res, next) => {
  let id = req.params.listId;
  let todoList = req.session.todoLists.find(list => Number(id) === list.id);

  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    res.render("list", {
      todoList: todoList,
      todos: sortTodos(todoList)
    });
  }
});

app.post("/lists/:listId/todos/:todoId/toggle", (req, res, next) => {
  let { listId, todoId } = {...req.params};
  let todoList = req.session.todoLists.find(list => Number(listId) === list.id);
  let todo = todoList.todos.find(todo => Number(todoId) === todo.id);

  if (todo === undefined) {
    next(new Error("Not found."));
  } else {
    let title = todo.title;
    if (todo.isDone()) {
      todo.markUndone();
      req.flash("success", `${title} marked not done.`);

    } else {
      todo.markDone();
      req.flash("success", `${title} marked done.`);
    }

    res.redirect(`/lists/${listId}`);
  }
});

app.post("/lists/:listId/todos/:todoId/destroy", (req, res, next) => {
  let { listId, todoId } = {...req.params};
  let todoList = req.session.todoLists.find(list => Number(listId) === list.id);
  let todo = todoList.todos.find(todo => Number(todoId) === todo.id);

  if (todo === undefined) {
    next(new Error("Not found."));
  } else {
    let title = todo.title;
    let index = todoList.findIndexOf(todo);
    todoList.removeAt(index);
    req.flash("success", `${title} removed.`);

    res.redirect(`/lists/${listId}`);
  }
});

app.post("/lists/:listId/complete_all", (req, res, next) => {
  let listId = req.params.listId;
  let todoList = req.session.todoLists.find(list => Number(listId) === list.id);

  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    todoList.markAllDone();
    req.flash("success", "All todos have been marked done.");

    res.redirect(`/lists/${listId}`);
  }
});

app.post("/lists/:listId/todos", [
  body("todoTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("The list title is required.")
    .isLength({ max: 100 })
    .withMessage("List title must be between 1 and 100 characters.")
],
(req, res, next) => {
  let listId = req.params.listId;
  let todoList = req.session.todoLists.find(list => Number(listId) === list.id);
  let errors = validationResult(req);

  if (todoList === undefined) {
    next(new Error("Not found."));
  } else if (!errors.isEmpty()) {
    errors.array().forEach(message => req.flash("error", message.msg));
    res.redirect(`/lists/${listId}`);
  } else {
    let title = req.body.todoTitle;
    todoList.add(new Todo(title));
    req.flash("success", `${title} added.`);

    res.redirect(`/lists/${listId}`);
  }
});

app.get("/lists/:listId/edit", (req, res, next) => {
  let listId = req.params.listId;
  let todoList = req.session.todoLists.find(list => Number(listId) === list.id);

  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    res.render("edit-list", { todoList: todoList });
  }
});

app.post("/lists/:listId/destroy", (req, res, next) => {
  let listId = req.params.listId;
  let todoList = req.session.todoLists.find(list => Number(listId) === list.id);

  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    let index = req.session.todoLists.indexOf(todoList);
    req.session.todoLists.splice(index, 1);

    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
});

app.post("/lists/:listId/edit", [
  body("todoListTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("The list title is required.")
    .isLength({ max: 100 })
    .withMessage("List title must be between 1 and 100 characters.")
    .custom((title, { req }) => {
      let duplicate = req.session.todoLists.find(list => list.title === title);
      return duplicate === undefined;
    })
    .withMessage("List title must be unique."),
], (req, res, next) => {
  let listId = req.params.listId;
  let todoList = req.session.todoLists.find(list => Number(listId) === list.id);
  let errors = validationResult(req);

  if (todoList === undefined) {
    next(new Error("Not found."));
  } else if (!errors.isEmpty()) {
    errors.array().forEach(message => req.flash("error", message.msg));
    res.render("edit-list", {
      todoListTitle: req.body.todoListTitle,
      todoList: todoList,
      flash: req.flash(),
    });
  } else {
    todoList.setTitle(req.body.todoListTitle);
    req.flash("success", "Todo list title updated");
    res.redirect(`/lists/${listId}`);
  }
});
// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}...`);
});
