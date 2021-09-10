const sortByTitle = list => {
  return list.sort((a, b) => {
    if (a.title.toLowerCase() < b.title.toLowerCase()) {
      return -1;
    } else if (a.title.toLowerCase() > b.title.toLowerCase()) {
      return 1;
    } else {
      return 0;
    }
  });
};

module.exports = {
  sortTodoLists(lists) {
    let doneLists = sortByTitle(lists.filter(list => list.isDone()));
    let unDoneLists = sortByTitle(lists.filter(list => !list.isDone()));
    return unDoneLists.concat(doneLists);
  },

  sortTodos(todoList) {
    let undone = todoList.todos.filter(todo => !todo.isDone());
    let done   = todoList.todos.filter(todo => todo.isDone());
    sortByTitle(undone);
    sortByTitle(done);
    return [].concat(undone, done);
  }
};
